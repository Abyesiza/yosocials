export enum AccountStatus {
  /** Credentials verified and working. */
  Active = 'active',
  /** The platform rejected the credentials; the user must reconnect. */
  NeedsReconnect = 'needs_reconnect',
}
