/** Queue Settings */
export const DEFAULT_QUEUE_SETTINGS={queueIntervalSeconds:120,patientMaxWaitSeconds:240,examMaxSeconds:300,refreshIntervalSeconds:30,nearTurnRefreshSeconds:7,autoCallEnabled:true,timeoutHandlerEnabled:true,examTimeoutEnabled:true,notificationsEnabled:true,showCountdownTimer:true,showQueuePosition:true,showEstimatedWait:true,showAheadCount:true,notifyNearAhead:3,graceMinutes:4,noticeTtlSeconds:30};
const STORAGE_KEY='mmc_queue_settings';
const ACTIVE_WAITING_STATES=new Set(['waiting','queued','ready','pending']);
const ACTIVE_EXAM_STATES=new Set(['called','in','in_progress','serving']);
const normalizeStatus=(status)=>String(status||'').toLowerCase();
const toNumber=(value)=>{const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;};
export function getQueueSettings(){try{const s=localStorage.getItem(STORAGE_KEY);if(s)return {...DEFAULT_QUEUE_SETTINGS,...JSON.parse(s)};}catch(e){console.error(e);}return {...DEFAULT_QUEUE_SETTINGS};}
export function saveQueueSettings(settings){const merged={...DEFAULT_QUEUE_SETTINGS,...settings};localStorage.setItem(STORAGE_KEY,JSON.stringify(merged));window.dispatchEvent(new CustomEvent('queueSettingsUpdated',{detail:merged}));return true;}
export function updateQueueSetting(key,value){const c=getQueueSettings();c[key]=value;return saveQueueSettings(c);}
export function resetQueueSettings(){localStorage.setItem(STORAGE_KEY,JSON.stringify(DEFAULT_QUEUE_SETTINGS));window.dispatchEvent(new CustomEvent('queueSettingsUpdated',{detail:DEFAULT_QUEUE_SETTINGS}));return {...DEFAULT_QUEUE_SETTINGS};}
export const secondsToMinutes=(s)=>Math.round(s/60);
export const minutesToSeconds=(m)=>m*60;
export function getEstimatedWaitTime(position){const settings=getQueueSettings();return Math.ceil(Math.max(0,position)*(settings.queueIntervalSeconds/60));}
export function isNearTurn(position){return position<=getQueueSettings().notifyNearAhead;}
export function getRemainingTime(calledAt,status,queuePosition=null){const settings=getQueueSettings();const now=Date.now();const normalized=normalizeStatus(status);if(ACTIVE_EXAM_STATES.has(normalized)){const t=toNumber(calledAt);const elapsed=Number.isFinite(t)?Math.floor((now-t)/1000):0;return Math.max(0,normalized==='in' || normalized==='in_progress' || normalized==='serving'?settings.examMaxSeconds-elapsed:settings.patientMaxWaitSeconds-elapsed);}const inferred=toNumber(queuePosition)??(toNumber(calledAt)&&toNumber(calledAt)<10000?toNumber(calledAt):null);if(ACTIVE_WAITING_STATES.has(normalized)){if(inferred!==null){return Math.max(1,getEstimatedWaitTime(inferred)*60);}return settings.patientMaxWaitSeconds;}if(normalized==='done'||normalized==='completed'||normalized==='cancelled'||normalized==='absent'||normalized==='no_show')return 0;if(inferred!==null){return Math.max(1,getEstimatedWaitTime(inferred)*60);}return settings.patientMaxWaitSeconds;}
export function shouldSkipPatient(calledAt,status){if(!getQueueSettings().timeoutHandlerEnabled)return false;return getRemainingTime(calledAt,status)<=0;}
export function onQueueSettingsChange(callback){const h=(e)=>callback(e.detail);window.addEventListener('queueSettingsUpdated',h);return()=>window.removeEventListener('queueSettingsUpdated',h);}
export default {DEFAULT_QUEUE_SETTINGS,getQueueSettings,saveQueueSettings,updateQueueSetting,resetQueueSettings,secondsToMinutes,minutesToSeconds,getEstimatedWaitTime,isNearTurn,getRemainingTime,shouldSkipPatient,onQueueSettingsChange};