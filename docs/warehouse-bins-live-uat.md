# Warehouse bins live UAT

Generated: 2026-09-10T11:38:59.507Z
API: http://localhost:4000

**39/39 PASS**

| Step | Result | Detail |
| --- | --- | --- |
| admin login | PASS | 201 |
| warehouse login | PASS | 201 |
| sales1 login | PASS | 201 |
| dealer nile login | PASS | 201 |
| zero null-location balances | PASS | 0 |
| zero null-location lots | PASS | 0 |
| zero null-location transactions | PASS | 0 |
| one default bin per warehouse | PASS | ok |
| reserved qty lives on bins | PASS | 0 |
| dealer cannot list warehouses | PASS | 403 |
| sales1 cannot create warehouses | PASS | 403 |
| RAW warehouse | PASS | RAW |
| RAW default bin | PASS | RAW-MAIN |
| create extra bin | PASS | 201 "UATA1" |
| extra bin has qrCode | PASS | BIN-RAW-UATA1 |
| create throwaway item | PASS | 201 |
| receive 8 into extra bin | PASS | 201 |
| receive 5 into default bin | PASS | 201 |
| item detail shows both bins | PASS | [{"loc":"3772324f-b616-4e50-94c9-37fe390c3320","qty":"8"},{"loc":"78ab989a-1274-453f-bd4b-4ffb1d3e9dc4","qty":"5"}] |
| issue 2 from extra bin | PASS | 201 |
| extra bin is 6 after named issue | PASS | 6 |
| default bin unchanged after named issue | PASS | 5 |
| create bin-to-bin transfer | PASS | 201 |
| complete bin-to-bin transfer | PASS | 201 |
| transfer moved 1 extra → default | PASS | {"extra":5,"main":6} |
| create per-bin count | PASS | 201 |
| count snapshots extra bin system qty | PASS | {"systemQty":"5","locationId":"3772324f-b616-4e50-94c9-37fe390c3320"} |
| post per-bin count | PASS | 201 |
| unnamed issue draws across bins | PASS | 201 |
| pooled issue left 3 across both bins | PASS | {"extra":3,"main":0} |
| demo reserved rows have bins | PASS | n=8 |
| resolve bin by printed QR | PASS | 200 |
| resolve bin by BIN:uuid fallback | PASS | 200 |
| single bin label is PDF | PASS | 200 185959b |
| bin label sheet is PDF | PASS | 200 188425b |
| record recovery into extra bin | PASS | 201 |
| post recovery into extra bin | PASS | 201 |
| recovery movement landed on extra bin | PASS | f9390cd7-72ab-4f66-874f-2494473b47d4 |
| throwaway SKU cleaned up | PASS | 0 |

## Evidence

```json
{
  "extraBin": {
    "id": "3772324f-b616-4e50-94c9-37fe390c3320",
    "code": "UATA1",
    "qrCode": "BIN-RAW-UATA1"
  }
}
```
