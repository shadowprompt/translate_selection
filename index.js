export default class TranslateSelection {
    constructor(options = {}) {
        this.options = options;
        this.init();
    }

    init() {
        this.config = {
            clearSelection: true,
            getWords: this.getWords,
            getTranslate: this.getTranslate,
            ...this.options,
        };
        this.window = this.config.frameSelector ? document.querySelector(this.config.frameSelector).contentWindow : window; // !!! Selection is dynamic, can not be stored, so this.window.getSelection() too.
        this.ranges = []; // the Range can stored, store the Range to store the Selection indirectly;
        this.parents = []; // this parents to replace
        this.previewParents = []; // the parent of preview dom
        this.previewInfo = {
            win: window,
            doc: window.document
        };
        this.traversalIndex = 0;
        this.selectedWords = [];
        this.translatedWords = [];
    }

    async start() {
        if (this.window.getSelection().rangeCount < 1) {
            this.notify({
                errorCode: 1,
                type: 'translate-stop',
                message: 'no selections!' // 无选中词
            });
            return
        }
        for (let i = 0; i < this.window.getSelection().rangeCount; i++) {
            const range = this.window.getSelection().getRangeAt(i);
            this.ranges.push(range.cloneRange()); // clone后确保ranges可以用来重试
            this.parents.push(range.commonAncestorContainer);
            const cloned = range.cloneContents();
            await this.translate(cloned);
            // 确保有翻译结果，并且翻译内容数组和原文数组长度一致
            if (this.translatedWords.length < 1) {
                this.config.notify({
                    errorCode: 2,
                    type: 'translate-stop',
                    message: 'translated noting. abort!' // 翻译结果返回空
                });
                return;
            }
            if (this.selectedWords.length !== this.translatedWords.length) {
                this.config.notify({
                    errorCode: 3,
                    type: 'translate-stop',
                    message: 'this translate and source mismatched. abort!' // 翻译返回结果和翻译词数量不匹配
                });
                return;
            }
            if (typeof this.config.previewTranslate === 'function') {
                // we use the normal window and document when preview
                // 创建一个预览节点
                const div = window.document.createElement('div');
                div.classList.add('translate-preview-container');
                div.append(cloned);
                this.previewParents.push(div);
                const {win, doc} = this.config.previewTranslate(div);
                this.previewInfo.win = win;
                this.previewInfo.doc = doc;
                this.window.getSelection().removeAllRanges();
                window.getSelection().removeAllRanges();
                const newRang = doc.createRange();
                // 选中预览节点
                newRang.selectNodeContents(div);
                win.getSelection().addRange(newRang);
                this.traversalParent(div, true);
                win.getSelection().empty();
                // restore the original selection for next translation
                this.restoreOriginalRanges();
                div.blur();
                this.config.notify({
                    errorCode: 0,
                    type: 'translate-over', // 成功翻译完毕
                })
                return;
            }
            this.replace();
        }
    }

    async translate(clonedFragment) {
        this.selectedWords = this.config.getWords(clonedFragment, []);
        this.translatedWords = await this.config.getTranslate(this.selectedWords);
    }

    replace() {
        // 预览时用户可能会修改翻译内容，此时以用户确认过的结果作为最终翻译结果
        if (typeof this.config.previewTranslate === 'function') {
            const finalTranslateWords = this.previewParents.map(item => this.getWords(item, []));
            // do array flat
            this.translatedWords = finalTranslateWords.reduce((total, curr) => [...total, ...curr], []);
        }
        this.parents.forEach(item => this.traversalParent(item));
        this.init();
        this.config.clearSelection && this.window.getSelection().empty();
    }

    /**
     *
     * @param clonedFragment return from Range.cloneContents
     * @param textArr = [] the words get from the clonedFragment
     * @returns textArr
     */
    getWords(clonedFragment, textArr) {
        const childNodes = clonedFragment.childNodes;
        if (childNodes && childNodes.length > 0) {
            childNodes.forEach(item => this.getWords(item, textArr));
        } else if (clonedFragment.nodeType === 3) {
            const data = clonedFragment.data || "";
            if (data.trim().length > 0) {
                // const targetText = data.replace(/\s/g, '');
                textArr.push(data);
            }
        }
        return textArr;
    }

    /**
     *
     * @param arr this.selectedWords
     * @returns translatedWordArr
     */
    getTranslate(arr) {
        return arr.map(item => item.split('').reverse().join(''));
    }

    notify(msg) {
        return console.warn(msg);
    }
    traversalParent(parent, isPreviewMode = false) {
        const win = isPreviewMode ? (this.previewInfo.win || window) : this.window; // the window is different according to preview mode
        let hit = 0;
        let isReached = false;
        const childNodes = parent.childNodes;
        if (childNodes && childNodes.length > 0) {
            for (let j = 0; j < parent.childNodes.length; j++) {
                const node = parent.childNodes[j];
                if (win.getSelection().containsNode(node)) {
                    isReached = true;
                    hit++;
                    this.traversalReplace(node, false, win)
                } else if (win.getSelection().containsNode(node, true)) {
                    isReached = true;
                    hit++;
                    this.traversalReplace(node, true, win)
                } else {
                    if (isReached) {
                        break;
                    }
                }
            }
        } else if (parent.nodeType === 3) {
            this.traversalReplace(parent, false, win);
        }
    }

    traversalReplace(node, allowPartialContainment, win) {
        const childNodes = node.childNodes;
        if (childNodes && childNodes.length > 0) {
            let isReached = false;
            for (let i = 0; i < childNodes.length; i++) {
                const item = childNodes[i];
                // node部分包含时，再遍历它的子节点时，要继续判断子节点是否包含
                if (allowPartialContainment && !win.getSelection().containsNode(item, true)) {
                    if (isReached) {
                        break;
                    }
                } else {
                    isReached = true;
                    this.traversalReplace(item, allowPartialContainment, win);
                }
            }
        } else if (node.nodeType === 3) {
            const data = node.data || '';
            if (data.trim().length < 1) {
                return;
            }
            let targetText = '';
            const translatedText = this.translatedWords[this.traversalIndex++] || '';
            if (node === win.getSelection().anchorNode) {
                // 存在node既是anchorNode又是focusNode的情况
                const tailText = node === win.getSelection().focusNode ? node.data.slice(win.getSelection().focusOffset) : '';
                targetText = node.data.slice(0, win.getSelection().anchorOffset) + translatedText + tailText;
            } else if (node === win.getSelection().focusNode) {
                targetText = translatedText + node.data.slice(win.getSelection().focusOffset);
            } else {
                targetText = translatedText;
            }
            // 此操作后会改变原来选中该node的Range的startOffset，endOffset等值。皮之不存毛将焉附
            node.data = targetText;
        }
    }
    restoreOriginalRanges(ranges = this.ranges) {
        this.window.getSelection().removeAllRanges();
        ranges.forEach(item => this.window.getSelection().addRange(item));
    }
}
