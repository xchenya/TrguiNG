/**
 * Webpack config for preview/demo builds.
 * Outputs to dist-demo/ — never touches dist/.
 * Uses NormalModuleReplacementPlugin to swap queries.ts with demo version.
 */

import { merge } from "webpack-merge";
import common, { __dirname } from "./webpack.common.js";
import path from "path";
import webpack from "webpack";
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";

export default merge(common("production"), {
    output: {
        path: path.resolve(__dirname, "dist-demo"),
        clean: true,
    },
    plugins: [
        new webpack.DefinePlugin({
            __BUILD_MODE__: JSON.stringify("demo"),
        }),
        new webpack.NormalModuleReplacementPlugin(
            /^queries$/,
            path.resolve(__dirname, "src/demo/demoQueries.ts"),
        ),
        new BundleAnalyzerPlugin({
            analyzerMode: "static",
            openAnalyzer: false,
            reportFilename: path.resolve(__dirname, "webpack-preview-report.html"),
        }),
    ],
});
