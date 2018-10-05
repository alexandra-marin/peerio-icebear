Configuration
=============

Peerio is configured in `app/package.json` under "peerio" key, which
contains the following keys:

* appId (string) — application identifier, must be the same as in root package.json.
* whiteLabel (object) — for internal peerio whitelabel builds like staging - keep name == ""
* keychainService (string) — app-unique name of keychain service for storing Account Key.
  (IMPORTANT: Changing this for the same app will invalidate autologin for all users.)
* socketServerUrl (string) — URL for socket server
* ghostFrontendUrl (string) — URL for ghost front-end
* usePeerioUpdater (boolean) — temporary value that is used until we switch to the new updater
* disablePayments (boolean) — whether to disable payments
* contacts — object:
    * supportUser (string) — Peerio support account
    * supportEmail (string) — support email address
    * feedbackUser (string) — Peerio feedback account
* translator — object:
    * stringReplacements — array of objects, each object contains:
        * original (string) — string to replace
        * replacement (string) — replacement value
    * urlMap — object mapping keys to strings:
        * contactFingerprint
        * mpDetail
        * tfaDetail
        * msgSignature
        * socialShareUrl
        * socialShareImage
        * upgrade
        * proWelcome
        * proAccount
        * helpCenter
        * contactSupport
        * errorServerUrl
        * mailSupport
        * iosApp
        * androidApp
        * googleAuthA
        * googleAuthI
        * authy

Release configuration
---------------------

When building a release, values in `app/package.json` are merged with values
in `release/overrides.json` under "app/package.json" key (values from the latter
replace values form the former). The values are merged recursively, so if
`translator -> urlMap -> androidApp` is not specified in the overrides, it
will be left as-is.
