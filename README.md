# translate_selection
translate and replace the selection words

# Start

```javascript
import TranslateSelection from "translate_selection";
const ts = new TranslateSelection();
ts.start();
```

You can also overwrite the `getWords` and `getTranslate` methods for your project

```typescript
/**
 *
 * @param clonedFragment return from Range.cloneContents
 * @param textArr = [] the words get from the clonedFragment
 * @returns textArr
 */
function getWords(clonedFragment, textArr) : array

/**
 * 
 * @param arr this.selectedWords
 * @returns translatedWordArr
 */
function getTranslate(arr: array) : array
```