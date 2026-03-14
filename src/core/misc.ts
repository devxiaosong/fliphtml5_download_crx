import { supabase } from './supabaseClient'
import { productInfo } from './config'
import { storageGet, storageSet } from '../utils/chromeStorage'

// 定义应用信息接口
export interface AppInfo {
    promptTxt: string;
    downloadUrl: string;
    showEntryBtn: boolean;
    showDownloadBtn: boolean;
}

// 定义 DynamicRules 类型
type DynamicRules = {
    static_param: string;
    format: string;
    checksum_indexes: number[];
    checksum_constant: number;
    app_token: string;
};

export let dynamicRules: DynamicRules | null = null

export let tierList: any[] | null = null

export let appInfo: AppInfo | null = null

export let memebership: any | null = null



export function logDebug(eventName:string, eventBody:string) {
    logEventInfo(eventName, eventBody,'debug')
}

export function logInfo(eventName:string, eventBody:string) {
    logEventInfo(eventName, eventBody,'info')
}

export function logWarning(eventName:string, eventBody:string) {
    logEventInfo(eventName, eventBody,'warning')
}

export function logSysError(eventName:string, eventBody:string) {
    console.error(eventName, eventBody)
    logEventInfo('sys', eventName+eventBody,'error')
}

export function logError(eventName:string, eventBody:string) {
    logEventInfo(eventName, eventBody,'error')
}

export function pairUserAndProductRelation() {
    logEventInfo('login', 'done', 'info')
}

function logEventInfo(
    eventName:string,
    eventBody:string,
    level:string
) {
    getDeviceId().then(deviceId => {
        const payload = {
            ...getProductInfo(),
            device_uuid: deviceId,
            event_name: eventName,
            event_body: eventBody,
            log_level: level
        }
        chrome.runtime.sendMessage({ action: "logEvent", payload }, () => {
            // 忽略响应和 lastError（火忘式）
            void chrome.runtime.lastError
        })
    })
}

export async function getAppInfo(): Promise<AppInfo | null> {
    if(appInfo) {
        return appInfo
    }

    await checkApp()

    return appInfo
}

export async function getTierList(): Promise<any[] | null> {
    if(tierList) {
        return tierList
    }

    await checkApp()

    return tierList
}

export async function getDynamicRule(): Promise<DynamicRules | null> {
    if(dynamicRules) {
        return dynamicRules
    }

    await checkApp()

    return dynamicRules
}

export async function getMembership(): Promise<any | null> {
    if(memebership) {
        return memebership
    }

    const productInfo = getProductInfo()
    const result = await new Promise<{ data: any; error: string | null }>((resolve) => {
        chrome.runtime.sendMessage(
            { action: "getMembership", productInfo },
            (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ data: null, error: chrome.runtime.lastError.message ?? "sendMessage failed" })
                } else {
                    resolve(response ?? { data: null, error: "empty response" })
                }
            }
        )
    })

    if (result.data) memebership = result.data
    return memebership
}

export async function makeSubscriptionOrder(tier_uuid: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('make-subscription-order', {
        body: { tier_uuid }
    })

    return data
}

async function checkApp() {
    const productInfo = getProductInfo()

    // 通过 background 发起请求，绕过 Firefox 内容脚本受页面 CSP 限制的问题
    const result = await new Promise<{ data: any; error: string | null }>((resolve) => {
        chrome.runtime.sendMessage(
            { action: "getAppConfig", productInfo },
            (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ data: null, error: chrome.runtime.lastError.message ?? "sendMessage failed" })
                } else {
                    resolve(response ?? { data: null, error: "empty response" })
                }
            }
        )
    })

    const data = result.data
    if (result.error) {
        console.warn("[check-app] error from background:", result.error)
    }
    if (data && typeof data === "object") {
        dynamicRules = data["dynamic_rules"] ?? null
        tierList     = data["tier_list"] ?? null
        appInfo      = data
    }
}

export function getProductInfo() {
    const st = productInfo

    st.version    = chrome.runtime.getManifest().version;

    st.product_id = chrome.runtime.id;

    return st
}

// 获取或生成唯一标识符
async function getDeviceId(): Promise<string> {
    const st = await storageGet('uniqueId')

    let uniqueId = ''
    if (!st || !st.uniqueId) {
        let createUniqueId = generateUUID();
        await storageSet({uniqueId: createUniqueId})
        uniqueId = createUniqueId
    } else {
        uniqueId = st.uniqueId as string
    }

    return uniqueId
}

// 生成随机的UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
