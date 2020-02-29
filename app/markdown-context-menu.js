module.exports = (fileOpened) => [  // 根据是否打开了文件，决定上下文的不同状态
    {
        label: '打开文件',
        click(item, focusWindow) {
            focusWindow.webContents.send('retransmission', 'select-file');
        }
    },
    {
        label: '在文件系统中显示',
        click(item, focusWindow) {
            focusWindow.webContents.send('show-in-finder');
        },
        enabled: fileOpened  // 根据是否打开了文件来决定这一项是否可用
    },
    {
        label: '使用默认程序打开',
        click(item, focusWindow) {
            focusWindow.webContents.send('open-in-default');
        },
        enabled: fileOpened  // 根据是否打开了文件来决定这一项是否可用
    },
    {type: 'separator'},
    {
        label: '剪切',
        role: 'cut'
    },
    {
        label: '复制',
        role: 'copy'
    },
    {
        label: '粘贴',
        role: 'paste'
    },
    {
        label: '全选',
        role: 'selectall'
    }
];