# Changelog

## 1.0.2

- Treat configured idempotent EDA codes such as AUC `301` as success even when
  EDA returns the SOAP fault with a non-2xx HTTP status.

## 1.0.1

- Add request ID options to EDA operations.
- Add number refresh and EDA-only SIM swap flows.
- Route AUC deletion through the core CAI3G endpoint.

## 1.0.0

- Initial EDA SOAP client for AirtelTigo Ericsson Data Access.
- Add cached login sessions and explicit logout support.
- Add AUC create/delete and HLR create/delete provisioning.
- Add voice barring, internet unbarring, and subscriber status operations.
- Add correct CAI3G SOAP actions and subscriber status request envelopes.
- Preserve EDA HTTP/SOAP faults with structured `data` and `metadata`.
- Distinguish unreachable EDA services from EDA response errors.
