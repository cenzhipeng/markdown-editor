const {app, BrowserWindow, dialog, ipcMain} = require('electron');
const setApplicationMenu = require('./application-menu');
const fs = require('fs');
const watch = require('node-watch');
// 所有的窗口保存在这里
const openWindows = new Set();
// key 是 browserWindow，value 是文件监视器 Watcher
const openFiles = new Map();

app.on('ready', () => {
    // 设置应用的菜单栏，一旦使用了自定义菜单，原先默认的菜单和快捷键就统统都不起作用了
    setApplicationMenu();
    createWindow();
});

/**
 * 所有窗口关闭的时候会触发这个事件，默认情况下，会关闭应用然后完全退出
 * 我们让应用保持在后台始终运行，可以运行一些后台任务，或者是注册一些全局可用的快捷键
 */
app.on('window-all-closed', () => {
    if (process.platform === 'darwin') { // darwin 表示应用处于 macos 系统
        return false; // 返回 false 取消默认行为：完全退出应用。此时应用会驻留在 dock 栏
    }
    app.quit(); // 如果不是 macos，那么就退出应用
});

/**
 * 当我们点击 dock 图标的时候触发这个事件
 * 如果这个时候没有可见的窗口，那么我们就创建一个，很符合我们正常的使用逻辑
 * 这个事件只在 macos 中能够触发
 */
app.on('activate', (event, hasVisibleWindows) => {
    if (!hasVisibleWindows) {
        createWindow();
    }
});

/**
 * 应用完全启动运行后触发这个事件
 * 只有完全启动后我们才可以提供打开文件的功能
 */
app.on('will-finish-launching', () => {
    /**
     * 当我们在别的地方使用应用打开文件时，触发这个 open-file 事件
     * 必须是应用完全启动后再添加这个事件，否则应用都没启动，很多功能都没有就绪，直接触发的话可能会出错
     */
    app.on('open-file', (event, file) => {
        console.log(file);
        const win = createWindow();
        win.once('ready-to-show', () => {
            openFile(win, file);
        })
    })
});

function intervalSetMenu() {
    setTimeout(() => {
        setApplicationMenu();
        console.log(1);
        intervalSetMenu();
    }, 1000);
}

function createWindow() {
    let newWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true
        },
        show: false  // 刚创建出来时，不要显示，避免先显示短暂的白屏
    });
    openWindows.add(newWindow);
    newWindow.maximize(); // 最大化 不等于全屏，最大化是保留系统任务栏等的
    newWindow.loadFile('app/index.html');
    newWindow.on('close', (e) => {
        if (newWindow.isDocumentEdited()) {
            e.preventDefault();
            // 退出的时候询问是否保存文档的修改
            dialog.showMessageBox(newWindow, {
                type: 'warning',
                title: '是否直接退出？',
                message: "文档尚未保存，直接退出将丢失所有修改",
                buttons: [
                    '直接退出',
                    '取消'
                ],
                defaultId: 0, // id 为 0 表示上面的 buttons 数组取第 0 个，将会作为回车键的默认选项
                cancelId: 1, // 如果用户关闭消息框，使用 buttons 数组的下标为 1 的选项作为返回值
            }).then(result => {
                if (result.response === 0) {
                    newWindow.destroy(); // 因为前面调用了 e.preventDefault(); 所以这里要手动关闭窗口
                    openWindows.delete(newWindow); //关闭窗口后，将其删除，防止泄露
                    stopWatchingFile(newWindow); // 窗口关闭后它的文件监视器也应该关闭
                    setApplicationMenu();
                    newWindow = null;
                }
            });
        } else {
            openWindows.delete(newWindow); //关闭窗口后，将其删除，防止泄露
            stopWatchingFile(newWindow); // 窗口关闭后它的文件监视器也应该关闭
            setApplicationMenu();
            newWindow = null;
        }
    });
    newWindow.once('ready-to-show', () => {
        newWindow.show(); // 加载完成后显示
    });
    newWindow.on('focus', setApplicationMenu);
    return newWindow;
}

function startWatchingFile(targetWindow, file) {
    stopWatchingFile(targetWindow);
    const watcher = watch(file, {recursive: false}, (eventName, fileName) => {
        if (eventName === 'update') {
            targetWindow.webContents.send('file-changed', file);
        }

        if (eventName === 'remove') {
            // todo 文件被删除了
        }
    });
    openFiles.set(targetWindow, watcher);
}

function stopWatchingFile(targetWindow) {
    if (openFiles.has(targetWindow)) {
        openFiles.get(targetWindow).close(); // 停止旧的监控器
        openFiles.delete(targetWindow);
    }
}

function openFile(targetWindow, targetPath) {
    fs.readFile(targetPath, (err, data) => {
        if (err) throw err;
        targetWindow.webContents.send('file-read-out', targetPath, data.toString());
        startWatchingFile(targetWindow, targetPath);
        app.addRecentDocument(targetPath); // 将这个文件加到最近文件，可以在 dock 栏看到最近文件
        // UI效果仅 macos 有用，添加了这个之后，我们将会在标题栏看到文件图标，可以拖拽图标发送给其它程序（方便的一批）
        targetWindow.setRepresentedFilename(targetPath);
    });
}

/**
 * 接收到渲染进程请求读取文件的消息
 */
ipcMain.on('file-read', (e, targetPath) => {
    e.preventDefault();
    const targetWindow = BrowserWindow.fromWebContents(e.sender);
    openFile(targetWindow, targetPath);
});

ipcMain.on('setApplicationMenu', setApplicationMenu);

/**
 * 收到渲染进程请求再打开一个窗口的请求
 */
ipcMain.on('create-window', () => {
    createWindow();
});

ipcMain.on('select-file-open-new-window', () => {
    const newWindow = createWindow();
    newWindow.once('show', () => {
        newWindow.webContents.send('retransmission', 'select-file');
    });
});

/**
 * 收到渲染进程请求弹出文件选择框然后将其打开
 */
ipcMain.on('select-file', e => {
    const targetWindow = BrowserWindow.fromWebContents(e.sender);
    dialog.showOpenDialog(targetWindow, { // 弹出文件打开对话框
        /**
         * 对话框可以设置有不同的属性 这里表示对话框只选择 一个 文件而不是目录或者多个文件
         * 其它可用的有：openDirectory multiselections
         */
        properties: ['openFile'],
        /**
         * 限定能够选择的文件的类型
         */
        filters: [
            {name: 'markdown文件', extensions: ['md', 'markdown']},
            {name: 'txt文件', extensions: ['txt']}
        ]
    }).then(result => {
        // arr.canceled 表示用户是否点了取消选择文件，如果是的话，那么 arr.filePaths 就是空数组
        // console.log(arr.filePaths); // 这个路径是选中文件的数组，我们选择单个文件数组就只会有一个值
        if (result.canceled) {
            return;
        }
        const filePath = result.filePaths[0];
        openFile(targetWindow, filePath);
    });
});

/**
 * 收到渲染进程保存markdown的请求
 */
ipcMain.on('save-markdown', (e, content) => {
    e.preventDefault();
    const targetWindow = BrowserWindow.fromWebContents(e.sender);
    dialog.showSaveDialog(targetWindow, {
        // macos 不显示这个标题
        title: '保存Markdown',
        // 默认使用用户的 documents 目录保存文件，这个目录的具体位置由操作系统来决定
        defaultPath: app.getPath('documents'),
        filters: [
            {name: 'Markdown文件', extensions: ['md', 'markdown']}
        ],
        // 保存按钮的文本内容（比如我们也可以设置为显示的是 Save）
        buttonLabel: '保存'
    }).then(result => {
        if (result.canceled) {
            return;
        }
        fs.writeFile(result.filePath, content, err => {
            if (err) throw err;
            openFile(targetWindow, result.filePath); // 写入完成后重新打开
        });
    })
});

/**
 * 收到渲染进程保存html的请求
 */
ipcMain.on('save-html', (e, content) => {
    e.preventDefault();
    const targetWindow = BrowserWindow.fromWebContents(e.sender);
    dialog.showSaveDialog(targetWindow, {
        // macos 不显示这个标题
        title: '保存HTML',
        // 默认使用用户的 documents 目录保存文件，这个目录的具体位置由操作系统来决定
        defaultPath: app.getPath('documents'),
        filters: [
            {name: 'HTML文件', extensions: ['html', 'htm']}
        ],
        // 保存按钮的文本内容（比如我们也可以设置为显示的是 Save）
        buttonLabel: '保存'
    }).then(result => {
        if (result.canceled) {
            return;
        }
        fs.writeFile(result.filePath, content, err => {
            if (err) throw err;
        });
    })
});

intervalSetMenu();
