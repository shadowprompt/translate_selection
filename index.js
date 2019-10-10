export default class TranslateSelection {
    constructor() {
        this.init();
    }

    init() {
        this.selection = document.getSelection();
        this.traversalIndex = 0;
        this.selectedWords = [];
        this.translatedWords = [];
    }

    async start() {
        for (let i = 0; i < this.selection.rangeCount; i++) {
            const range = this.selection.getRangeAt(i);
            const cloned = range.cloneContents();
            await this.exec(cloned);
            const parent = range.commonAncestorContainer;
            this.traversalParent(parent);
        }
        getSelection().empty();
    }

    async exec(clonedFragment) {
        this.selectedWords = this.getWords(clonedFragment, []);
        this.translatedWords = await this.getTranslate(this.selectedWords);
    }

    reverse(text) {
        return text.split('').reverse().join('');
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
        return arr.map(item => this.reverse(item));
    }

    traversalParent(parent) {
        let isReached = false;
        const childNodes = parent.childNodes;
        if (childNodes && childNodes.length > 0) {
            for (let j = 0; j < parent.childNodes.length; j++) {
                const node = parent.childNodes[j];
                if (this.selection.containsNode(node)) {
                    isReached = true;
                    this.traversalReplace(node, false)
                } else if (this.selection.containsNode(node, true)) {
                    isReached = true;
                    this.traversalReplace(node, true)
                } else {
                    if (isReached) {
                        break;
                    } else {
                    }
                }
            }
        } else if (parent.nodeType === 3) {
            this.traversalReplace(parent, false);
        }
    }

    traversalReplace(node, allowPartialContainment) {
        const childNodes = node.childNodes;
        if (childNodes && childNodes.length > 0) {
            let isReached = false;
            for (let i = 0; i < childNodes.length; i++) {
                const item = childNodes[i];
                // node部分包含时，再遍历它的子节点时，要继续判断子节点是否包含
                if (allowPartialContainment && !this.selection.containsNode(item, true)) {
                    if (isReached) {
                        break;
                    }
                } else {
                    isReached = true;
                    this.traversalReplace(item, allowPartialContainment);
                }
            }
        } else if (node.nodeType === 3) {
            const data = node.data || "";
            if (data.trim().length < 1) {
                return;
            }
            let targetText = '';
            if (node === this.selection.anchorNode) {
                // 存在node既是anchorNode又是focusNode的情况
                const tailText = node === this.selection.focusNode ? node.data.slice(this.selection.focusOffset) : '';
                targetText = node.data.slice(0, this.selection.anchorOffset) + this.translatedWords[this.traversalIndex++] + tailText;
            } else if (node === this.selection.focusNode) {
                targetText = this.translatedWords[this.traversalIndex++] + node.data.slice(this.selection.focusOffset);
            } else {
                targetText = this.translatedWords[this.traversalIndex++];
            }
            node.data = targetText;
        }
    }
}