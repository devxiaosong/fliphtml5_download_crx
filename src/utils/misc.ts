import { supabase } from '../supabaseClient'
import { productInfo } from './config'

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

export let dynamicRules:DynamicRules      = null

export let tierList: (null | undefined)[] = null

export let appInfo: AppInfo | null = null

export let memebership: null | undefined  = null


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

function logEventInfo(
    eventName:string,
    eventBody:string,
    level:string
) {
    getDeviceId().then(data=>{
        supabase.functions.invoke('log-event', {
            body: JSON.stringify(
                {
                    ...getProductInfo(),
                    device_uuid: data,
                    event_name: eventName,
                    event_body: eventBody,
                    log_level: level
                }
            )
        });
    })
}

export async function getAppInfo(): Promise<AppInfo | null> {
    if(appInfo) {
        return appInfo
    }

    await checkApp()

    return appInfo
}

async function checkApp() {
    const {data, error} = await supabase.functions.invoke('check-app', {
        body: getProductInfo()
    });

    dynamicRules = data['dynamic_rules']

    tierList     = data['tier_list']

    appInfo      = data
}

export function getProductInfo() {
    const st = productInfo

    st.version    = chrome.runtime.getManifest().version;
    st.product_id = chrome.runtime.id;

    return st
}

// 获取或生成唯一标识符
async function getDeviceId() {
    const st = await chrome.storage.local.get('uniqueId')

    let uniqueId =''
    if (!st || !st.uniqueId) {
        let createUniqueId = generateUUID();
        await chrome.storage.local.set({uniqueId: createUniqueId})
        uniqueId = createUniqueId
    } else {
        uniqueId = st.uniqueId
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
