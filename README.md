# liveNumberFormat.js

A tiny Javascript library that gives live as-you-type formatting to numbers & currencies, ~1600 bytes minified + gzipped.

[View demo](https://abhinavxd.github.io/liveNumberFormat.js/)

![output](https://github.com/abhinavxd/liveNumberFormat.js/assets/48166553/292b51d9-b2bd-4a74-9217-82c843de303d)



Check the [demo source](https://github.com/abhinavxd/liveNumberFormat.js/blob/main/docs/index.html).


## Usage
```
npm i live-number-format
```

Default values for config shown below.

```HTML
<input type="text"/>
```

```javascript
let input = document.querySelector("input");
new LiveNumberFormat(input,
{
        // Options for formatStyle
        // 1. thousandLakhCrore
        // 2. thousand
        // 3. tenThousand
        formatStyle: "thousand",

        stripLeadingZeroes: false,

        allowNegative: true,

        // Max integer digits allowed.
        // defaults to Infinity
        integerScale: 20,

        // Max decimals digits allowed.
        // defaults to Infinity
        decimalScale: 7
});
```
