# liveNumberFormat.js

A tiny Javascript library that gives live as-you-type formatting to numbers & currencies, ~1600 bytes minified + gzipped.

[View demo](https://abhinavxd.github.io/liveNumberFormat.js/)

![output](https://github.com/abhinavxd/liveNumberFormat.js/assets/48166553/8a00d7b2-64e2-4557-80d8-6dc214c3ff24)



Check the [demo source](https://github.com/abhinavxd/liveNumberFormat.js/blob/main/docs/index.html).


## Optional config

Default values shown below.

```javascript
new LiveNumberFormat(input,
{
        // Options for formatStyle
        // 1. thousandLakhCrore
        // 2. thousand
        // 3. tenThousand
        formatStyle: "thousand",

        stripLeadingZeroes: false,

        allowNegative: true,

        // Max integers allowed.
        // defaults to Infinity
        integerScale: 20,

        // Max decimals allowed.
        // defaults to Infinity
        decimalScale: 7
});
```
