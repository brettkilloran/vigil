import packageJson from "../../package.json";

/** Shipped app semver — bump `version` in root `package.json` for each release. */
export const HEARTGARDEN_APP_VERSION: string = packageJson.version;
