/**
 * DOM 操作辅助工具函数
 */

/**
 * 使用 XPath 查询单个元素
 * @param xpath XPath 表达式
 * @returns 匹配的第一个元素，如果没有找到则返回 null
 */
export function getElementByXPath(xpath: string): Element | null {
  const result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  )
  return result.singleNodeValue as Element | null
}

/**
 * 使用 XPath 查询多个元素
 * @param xpath XPath 表达式
 * @returns 匹配的所有元素数组
 */
export function getElementsByXPath(xpath: string): Element[] {
  const result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  )
  const elements: Element[] = []
  for (let i = 0; i < result.snapshotLength; i++) {
    const node = result.snapshotItem(i)
    if (node) elements.push(node as Element)
  }
  return elements
}

/**
 * 等待指定的 XPath 元素出现在页面上
 * @param xpath XPath 表达式
 * @param maxWaitTime 最大等待时间（毫秒），默认 10000ms
 * @param checkInterval 检查间隔（毫秒），默认 100ms
 * @returns Promise<boolean> 元素是否在指定时间内出现
 */
export async function waitForElementByXPath(
  xpath: string,
  maxWaitTime: number = 10000,
  checkInterval: number = 100
): Promise<boolean> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    const element = getElementByXPath(xpath) as HTMLElement
    if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }

  return false
}

/**
 * 点击指定 XPath 的元素
 * @param xpath XPath 表达式
 * @returns 是否成功点击
 */
export function clickElementByXPath(xpath: string): boolean {
  const element = getElementByXPath(xpath) as HTMLElement

  if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
    element.click()
    return true
  }

  return false
}

/**
 * 获取指定 XPath 元素的属性值
 * @param xpath XPath 表达式
 * @param attribute 属性名
 * @returns 属性值，如果元素不存在或属性不存在则返回 null
 */
export function getAttributeByXPath(xpath: string, attribute: string): string | null {
  const element = getElementByXPath(xpath)
  if (element) {
    return element.getAttribute(attribute)
  }
  return null
}

/**
 * 获取指定 XPath input 元素的值
 * @param xpath XPath 表达式
 * @returns input 的值，如果元素不存在或不是 input 元素则返回空字符串
 */
export function getInputValueByXPath(xpath: string): string {
  const element = getElementByXPath(xpath)
  if (element && element instanceof HTMLInputElement) {
    return element.value || ''
  }
  return ''
}
