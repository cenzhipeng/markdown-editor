const marked = require('marked'); // markdown 编译
const markdownContextMenuTemplate = require('./markdown-context-menu');
const frontMatter = require('front-matter'); // 获取 markdown 头部的元数据
const path = require('path');
const {remote, ipcRenderer} = require('electron');
// markdown上下文菜单
const markdownContextMenu = remote.Menu.buildFromTemplate(markdownContextMenuTemplate);
// 当前窗口
const currentWindow = remote.getCurrentWindow();
const app = remote.app;
// 当前窗口的文件路径
let filePath = null;
// 当前窗口的原始内容（默认是空的，打开文件后是文件的原始内容）
let originalContent = '';
// fileChangeBox 对话框是否还存在在界面里
let fileChangeBox = false;

const markdownView = document.querySelector('#markdown');
const htmlView = document.querySelector('#html');
const newFileButton = document.querySelector('#new-file');
const openFileButton = document.querySelector('#open-file');
const saveMarkdownButton = document.querySelector('#save-markdown');
const revertButton = document.querySelector('#revert');
const saveHtmlButton = document.querySelector('#save-html');
const showFileButton = document.querySelector('#show-file');
const openInDefaultButton = document.querySelector('#open-in-default');

function renderMarkdown2Html(markdown) {
    const content = frontMatter(markdown);
    // content.frontmatter  这里是元数据信息
    htmlView.innerHTML = marked(content.body, {
        sanitize: true // 防止注入，将HTML屏蔽掉
    });
}

/**
 * 编辑了内容的时候，更新用户界面
 * 主要包括：标题显示、保存和撤回按钮等
 */
function updateUserInterface(isEdited) {
    let defaultPath = '未命名';
    if (filePath) {
        defaultPath = filePath;
    }
    let title = '影子编辑器';
    title = `${path.basename(defaultPath)} - ${title}`;
    if (isEdited) {
        title = `${title} ●`
    }
    currentWindow.setTitle(title);
    /**
     * macos 专有的 API，这里设置成已编辑之后，左上角的关闭按钮将会显示成一个小圆点
     */
    currentWindow.setDocumentEdited(isEdited);
    saveMarkdownButton.disabled = !isEdited;
    revertButton.disabled = !isEdited;
}

/**
 * 用户一次可以拖拽多个文件
 * 但是我们只支持打开一个，所以选择数组第一项
 * 我们拖拽时只能访问元数据，只有 drop 的时候才能真正访问这个文件
 * @param event
 * @returns {DataTransferItem}
 */
function getDraggedFile(event) {
    return event.dataTransfer.items[0];
}

/**
 * 与 getDraggedFile 很类似
 * 但是这时用户已经完成了拖拽操作，应用不仅可以访问文件的元数据
 * 还可以访问文件本身
 * @param event
 * @returns {File}
 */
function getDroppedFile(event) {
    return event.dataTransfer.files[0];
}

/**
 * 检查拖拽的文件是否受到支持
 * @param file
 * @returns {boolean}
 */
function fileTypeIsSupported(file) {
    return ['.md', '.markdown', '.txt', '.text'].includes(path.extname(file.name));
}

function renderFile(file, content) {
    filePath = file;
    originalContent = content;
    markdownView.value = content;
    renderMarkdown2Html(content);
    updateUserInterface(false);
}

/**
 * 这个事件表示当在这个元素上右键点击的时候，弹出上下文菜单
 */
markdownView.addEventListener('contextmenu', e => {
    e.preventDefault();
    //弹出上下文菜单
    markdownContextMenu.popup();
});

/**
 * 拖拽到了 markdown 文本框上方时，持续触发，几百毫秒一次
 */
markdownView.addEventListener('dragover', e => {
    e.preventDefault();
    markdownView.classList.add('drag-over');
});

/**
 * 从 markdown 文本框上方挪开时触发一次
 * 移除掉拖拽时的效果
 */
markdownView.addEventListener('dragleave', e => {
    e.preventDefault();
    markdownView.classList.remove('drag-over');
});

/**
 * 拖拽完成时的操作
 * 再次判断是否是支持的文件
 * 支持的文件就打开
 */
markdownView.addEventListener('drop', e => {
    e.preventDefault();
    const file = getDroppedFile(e);
    if (fileTypeIsSupported(file)) {
        if (currentWindow.isDocumentEdited()) {
            // 当前已经被编辑过了，需要确认是否丢失更改直接打开文件
            remote.dialog.showMessageBox(currentWindow, {
                type: 'warning',
                title: '是否打开新文件？',
                message: "文档尚未保存，直接打开新文件将丢失所有修改",
                buttons: [
                    '直接打开',
                    '取消'
                ],
                defaultId: 0, // id 为 0 表示上面的 buttons 数组取第 0 个，将会作为回车键的默认选项
                cancelId: 1, // 如果用户关闭消息框，使用 buttons 数组的下标为 1 的选项作为返回值
            }).then(result => {
                if (result.response !== 1) {
                    ipcRenderer.send('file-read', file.path);
                }
            })
        } else {
            ipcRenderer.send('file-read', file.path);
        }
    } else {
        alert('不支持该类型文件，请打开 txt/markdown 文件');
    }
    markdownView.classList.remove('drag-over');
});

markdownView.oninput = function (e) {
    const currentContent = e.target.value;
    renderMarkdown2Html(currentContent);
    updateUserInterface(currentContent !== originalContent);
};

openFileButton.addEventListener('click', e => {
    e.preventDefault();
    ipcRenderer.send('select-file');
});
// 菜单栏传过来事件
currentWindow.on('select-file', () => ipcRenderer.send('select-file'));

newFileButton.addEventListener('click', e => {
    e.preventDefault();
    ipcRenderer.send('create-window');
});
currentWindow.on('create-window', () => ipcRenderer.send('create-window'));

saveHtmlButton.addEventListener('click', e => {
    e.preventDefault();
    ipcRenderer.send('save-html', htmlView.innerHTML);
});
currentWindow.on('save-html', () => ipcRenderer.send('save-html'));

saveMarkdownButton.addEventListener('click', e => {
    e.preventDefault();
    ipcRenderer.send('save-markdown', markdownView.value);
});
currentWindow.on('save-markdown', () => ipcRenderer.send('save-markdown'));

revertButton.addEventListener('click', e => {
    e.preventDefault();
    markdownView.value = originalContent;
    renderMarkdown2Html(originalContent);
    updateUserInterface();
});

/**
 * 该事件表示当前应用打开文件
 */
ipcRenderer.on('file-opened', (event, currentPath, content) => {
    if (currentWindow.isDocumentEdited()) {
        // 当前已经被编辑过了，需要确认是否丢失更改直接打开文件
        remote.dialog.showMessageBox(currentWindow, {
            type: 'warning',
            title: '是否打开新文件？',
            message: "文档尚未保存，直接打开新文件将丢失所有修改",
            buttons: [
                '直接打开',
                '取消'
            ],
            defaultId: 0, // id 为 0 表示上面的 buttons 数组取第 0 个，将会作为回车键的默认选项
            cancelId: 1, // 如果用户关闭消息框，使用 buttons 数组的下标为 1 的选项作为返回值
        }).then(result => {
            if (result.response !== 1) {
                renderFile(currentPath, content);
            }
        })
    } else {
        renderFile(currentPath, content);
    }
});

/**
 * 该事件表示当前窗口打开的文件，被其它程序修改了
 */
ipcRenderer.on('file-changed', (event, currentPath) => {
    if (fileChangeBox === false) {
        fileChangeBox = true; // 不让新的对话框打开
        remote.dialog.showMessageBox(currentWindow, {
            type: 'warning',
            title: '是否重新加载？',
            message: "文档已被其它程序修改，是否重新加载",
            buttons: [
                '是',
                '否'
            ],
            defaultId: 0, // id 为 0 表示上面的 buttons 数组取第 0 个，将会作为回车键的默认选项
            cancelId: 1, // 如果用户关闭消息框，使用 buttons 数组的下标为 1 的选项作为返回值
        }).then(result => {
            fileChangeBox = false; // 此时可以再次触发文件更改事件
            if (result.response !== 1) {
                // 告诉主进程读取这个文件
                ipcRenderer.send('file-read', currentPath);
            }
        })
    }
});

/**
 * 获取到了文件的数据流，直接打开渲染界面
 */
ipcRenderer.on('file-read-out', (e, targetPath, content) => {
    renderFile(targetPath, content);
});

/**
 * 以下取消默认的拖拽事件
 */
document.addEventListener('dragstart', e => {
    e.preventDefault();
});
document.addEventListener('dragover', e => {
    e.preventDefault();
});
document.addEventListener('dragleave', e => {
    e.preventDefault();
});
document.addEventListener('drop', e => {
    e.preventDefault();
});

