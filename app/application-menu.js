const {app, ipcMain, Menu, dialog} = require('electron');
const template = [
    {
        label: '文件',
        submenu: [
            {
                label: '打开一个新的窗口',
                accelerator: 'CommandOrControl+N',
                click(item, focusWindow) {
                    //通知主进程创建窗口
                    ipcMain.emit('create-window');
                }
            },
            // 以下菜单内容在窗口丢失焦点的时候，都会出问题
            {
                label: '打开文件',
                accelerator: 'CommandOrControl+O',
                click(item, focusWindow) {
                    focusWindow.emit('select-file');
                }
            },
            {
                label: '保存文件',
                accelerator: 'CommandOrControl+S',
                click(item, focusWindow) {
                    focusWindow.emit('save-markdown');
                }
            },
            {
                label: '导出HTML',
                accelerator: 'Shift+CommandOrControl+S',
                click(item, focusWindow) {
                    focusWindow.emit('save-html');
                }
            },
        ]

    }
    ,
    {
        label: '编辑',
        submenu: [
            // role 在 macos 有一些单独提供的值，表示一些 macos 提供的操作
            {
                label: '撤销',
                accelerator: 'CommandOrControl+Z',
                role: 'undo',
            },
            {
                label: '恢复',
                accelerator: 'Shift+CommandOrControl+Z',
                role: 'redo',
            },
            {type: 'separator'}, // 菜单到这里添加一个水平分割线
            {
                label: '剪切',
                accelerator: 'CommandOrControl+X',
                role: 'cut',
            },
            {
                label: '复制',
                accelerator: 'CommandOrControl+C', // 这里定义的是快捷方式
                role: 'copy' // role 有一些特定值，表示一些特定的操作 https://www.electronjs.org/docs/api/menu-item
            },
            {
                label: '粘贴',
                accelerator: 'CommandOrControl+V',
                role: 'paste'
            },
            {
                label: '全选',
                accelerator: 'CommandOrControl+A',
                role: 'selectall',
            }
        ]
    },
    {
        label: '窗口',
        role: 'window', // 如果是 macos，这里会在菜单栏的末尾添加当前应用所有窗口的列表
        submenu: [
            {
                label: '最小化',
                accelerator: 'CommandOrControl+M',
                role: 'minimize',
            },
            {
                label: '关闭',
                accelerator: 'CommandOrControl+W',
                role: 'close',
            },
        ]
    },
    {
        label: '帮助',
        role: 'help',
        submenu: [
            {
                label: '在线文档',
                click() {
                    //todo
                }
            },
            {
                label: '打开开发者工具',
                click(item, focusWindow, event) {
                    // 上面的参数表示这个方法所属菜单项和当前聚焦的窗口，以及此次的事件
                    if (focusWindow) {
                        focusWindow.webContents.toggleDevTools();
                    }
                },
                accelerator: 'Command+Shift+C'
            }
        ]
    }
];

if (process.platform === 'darwin') {
    // macos 会默认使用 'electron' 作为第一个菜单栏名称，所以我们添加一个默认菜单项到第一个菜单里抵充掉影响
    // 这个菜单项始终显示的是 electron，我们必须修改 INFO.plist 才可以
    const name = '影子编辑器';
    template.unshift({
        label: name,
        submenu: [
            {
                label: `关于${name}`,
                role: 'about'
            },
            {type: 'separator'},
            {
                label: '服务',
                role: 'services',
                submenu: []
            },
            {type: 'separator'},
            {
                label: `隐藏${name}`,
                accelerator: 'Command+H',
                role: 'hide'
            },
            {
                label: '隐藏其它',
                accelerator: 'Command+Alt+H',
                role: 'hideothers'
            },
            {
                label: '显示所有',
                role: 'unhide'
            },
            {type: 'separator'},
            {
                label: `退出${name}`,
                accelerator: 'Command+Q',
                click() {
                    app.quit(); //没用内置的退出方法，这里表示会触发这个动作
                }
            }
        ]
    });
    const windowMenu = template.find(item => item.label === '窗口');
    windowMenu.submenu.push(
        {type: 'separator'},
        {
            label: '全部显示',
            role: 'front' // macos 让应用的所有窗口置于顶层（没啥太大卵用）
        }
    );
}

module.exports = Menu.buildFromTemplate(template);