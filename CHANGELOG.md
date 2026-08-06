# Changelog

## 1.0.0

- Initial EDA SOAP client for AirtelTigo Ericsson Data Access.
- Add cached login sessions and explicit logout support.
- Add AUC create/delete and HLR create/delete provisioning.
- Add voice barring, internet unbarring, and subscriber status operations.
- Add correct CAI3G SOAP actions and subscriber status request envelopes.
- Preserve EDA HTTP/SOAP faults with structured `data` and `metadata`.
- Distinguish unreachable EDA services from EDA response errors.
