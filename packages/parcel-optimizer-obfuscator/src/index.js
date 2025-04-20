//@ts-check

const { Optimizer } = require("@parcel/plugin");
const pkg = require("@parcel/utils");
const { jsConfuser } = require("./steps/js-confuser.js");
const { jsObfuscator } = require("./steps/js-obfuscator.js");

const steps = [jsObfuscator];

module.exports = new Optimizer({
  async optimize({ contents, map, bundle }) {
    let code = await pkg.blobToString(contents);
    code = code.replace(/node:/g, "");

    if (!bundle.env.shouldOptimize) {
      return { contents: code, map };
    }

    const isBrowser = bundle.env.isBrowser();
    for (const step of steps) {
      if (step.constructor.name === "AsyncFunction") {
        code = await step(code, isBrowser);
      } else code = step(code, isBrowser);
    }

    return {
      contents: code,
    };
  },
});
