declare module "../../config/constants.json" {
  interface Constants {
    TIMEZONE: string;
    SERVICE_DAY_PIVOT: string;
    QUEUE_INTERVAL_SECONDS: number;
    PIN_LATE_MINUTES: number;
    PIN_DIGITS: number;
    PIN_RANGE_PER_CLINIC: [string, string];
    MOBILE_QR_ONLY: boolean;
    DESKTOP_BASIC_AUTH: boolean;
    NOTIFY_NEAR_AHEAD: number;
    NOTICE_TTL_SECONDS: number;
  }
  const constants: Constants;
  export default constants;
}

declare module "../../config/clinics.json" {
  interface Clinic {
    id: string;
    name: string;
    floor: string;
  }
  interface Clinics {
    [key: string]: Clinic;
  }
  const clinics: Clinics;
  export default clinics;
}

declare module "../../../config/routeMap.json" {
  interface RouteMapGeneral {
    prefix: string;
    M: string[];
    F: string[];
  }
  interface RouteMap {
    [key: string]: string[] | RouteMapGeneral;
  }
  const routeMap: RouteMap;
  export default routeMap;
}

