module.exports = [
    {
        label: '打开文件',
        click(item, focusWindow) {
            focusWindow.emit('select-file');
        }
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