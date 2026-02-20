// 根据编译目标自动设置浏览器类型
// Plasmo 会在编译时设置 process.env.PLASMO_BROWSER 环境变量
const getBrowserType = (): string => {
    // process.env.PLASMO_BROWSER 可能的值: "chrome", "firefox", "edge", "safari"
    const browser = process.env.PLASMO_BROWSER || "chrome"
    return browser
}

export const productInfo = {
    product_alias: "crx_fliphtml5_downloader",
    branch: "main",
    browser_type: getBrowserType(),
    distribution: "production",
    version: "",
    product_id: "",
}
