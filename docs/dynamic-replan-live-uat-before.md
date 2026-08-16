# Dynamic replan live UAT — baseline

Captured 2026-08-15T17:04:39.009Z against http://localhost:4000 / maher_erp.

```json
{
  "generatedAt": "2026-08-15T17:04:39.009Z",
  "timezone": "Asia/Amman",
  "today": "2026-08-15",
  "days": {
    "dayA": "2026-08-24",
    "dayB": "2026-08-26",
    "dayC": "2026-08-29",
    "dayF": "2026-08-30",
    "dayG": "2026-08-31",
    "dayH": "2026-09-01",
    "dayI": "2026-08-26",
    "dayE": "2026-10-24",
    "dayOt": "2026-08-29",
    "dayP": "2026-08-29",
    "requestedW": "2026-08-20",
    "committedW": "2026-08-23",
    "healthyDue": "2026-10-22",
    "firstOpenAfterSqueeze": "2026-08-24",
    "squeezeDays": [
      "2026-08-24",
      "2026-08-26"
    ]
  },
  "dashboard": {
    "awaitingApproval": 48,
    "needsReview": 3,
    "approvedActive": 0,
    "atRisk": 18,
    "conflicts": 2,
    "todayCount": 0,
    "weekCount": 0,
    "approvalsWaiting": 51,
    "alerts": 20
  },
  "atRiskCount": 18,
  "conflictCount": 2,
  "factoryLoadDayA": {
    "isWorking": false,
    "booked": 0,
    "shift": 0,
    "pct": 0,
    "pinned": 0
  },
  "calendarDayA": {
    "date": "2026-08-24",
    "isWorking": false,
    "intervals": [],
    "pinnedOnClosedDayCount": 0
  },
  "collateralIncompleteOrders": [
    {
      "id": "00e15099-bd04-4b6e-8538-022b06d57b15",
      "number": "PO-2026-00055",
      "status": "IN_PROGRESS"
    },
    {
      "id": "05ddade1-c8a4-4387-b0b8-70659ef8266c",
      "number": "PO-2026-00045",
      "status": "IN_PROGRESS"
    },
    {
      "id": "12060698-75a9-43b0-b10a-41cee2f88320",
      "number": "PO-2026-00043",
      "status": "IN_PROGRESS"
    },
    {
      "id": "1493e3eb-7a62-4083-a917-7df0591eb636",
      "number": "PO-2026-00028",
      "status": "IN_PROGRESS"
    },
    {
      "id": "162519e8-1b38-4d6c-a126-311a3dbcd220",
      "number": "PO-2026-00036",
      "status": "IN_PROGRESS"
    },
    {
      "id": "1f43438d-0258-4ee5-9e4d-61f95f5c7d5f",
      "number": "PO-2026-00019",
      "status": "IN_PROGRESS"
    },
    {
      "id": "230b694d-7c41-40f6-a503-49d553d8e89e",
      "number": "PO-2026-00034",
      "status": "IN_PROGRESS"
    },
    {
      "id": "26162020-986a-4b84-b563-3d1acd782beb",
      "number": "PO-2026-00050",
      "status": "IN_PROGRESS"
    },
    {
      "id": "26b66004-51f9-4afe-88af-d7da39ad0082",
      "number": "PO-2026-00039",
      "status": "IN_PROGRESS"
    },
    {
      "id": "2c746d6e-fb3a-4254-a011-4b9274a3448a",
      "number": "PO-2026-00060",
      "status": "READY_FOR_DELIVERY"
    },
    {
      "id": "304fe1de-a07c-4f87-8ead-72055e467f0c",
      "number": "PO-2026-00025",
      "status": "READY_FOR_DELIVERY"
    },
    {
      "id": "330040b8-24f7-40b6-95e2-f7cba2f02a38",
      "number": "PO-2026-00041",
      "status": "IN_PROGRESS"
    },
    {
      "id": "39be0583-740d-4684-8f6e-4dab0a87034b",
      "number": "PO-2026-00007",
      "status": "READY_FOR_DELIVERY"
    },
    {
      "id": "3bf0d292-510c-4024-a7aa-3b5b30da906c",
      "number": "PO-2026-00027",
      "status": "IN_PROGRESS"
    },
    {
      "id": "45256d1d-c47c-4222-956b-4058c68b31d8",
      "number": "PO-2026-00024",
      "status": "IN_PROGRESS"
    },
    {
      "id": "46b68fb1-96e5-4497-bc6e-b2d7fa50bc26",
      "number": "PO-2026-00037",
      "status": "IN_PROGRESS"
    },
    {
      "id": "4857dd37-52d7-4269-9e00-cd4a546b965f",
      "number": "PO-2026-00032",
      "status": "IN_PROGRESS"
    },
    {
      "id": "48ffde85-2b3d-48bb-b676-fd96c7d383d8",
      "number": "PO-2026-00035",
      "status": "IN_PROGRESS"
    },
    {
      "id": "4c573c98-a556-4ac3-9f77-23c8a6c05df1",
      "number": "PO-2026-00003",
      "status": "READY_FOR_DELIVERY"
    },
    {
      "id": "4daa8987-a796-46bb-b999-6b78da95e0e9",
      "number": "PO-2026-00053",
      "status": "IN_PROGRESS"
    },
    {
      "id": "4ec0ea02-ef7b-482b-a4e2-25ff834a59cf",
      "number": "PO-2026-00061",
      "status": "READY_FOR_DELIVERY"
    },
    {
      "id": "54187db2-805f-43e5-b09d-5b6c86c354ff",
      "number": "PO-2026-00026",
      "status": "IN_PROGRESS"
    },
    {
      "id": "5eaf059e-b7ce-4fa8-920b-cc17d00f7866",
      "number": "PO-2026-00059",
      "status": "READY_FOR_DELIVERY"
    },
    {
      "id": "62c2558e-f3c5-4eef-8c0d-cb6c6be0d2d2",
      "number": "PO-2026-00057",
      "status": "IN_PROGRESS"
    },
    {
      "id": "675ace31-6b64-4bfd-969f-2dd9b67b3c46",
      "number": "PO-2026-00010",
      "status": "IN_PROGRESS"
    },
    {
      "id": "68af005a-07a4-4a15-803f-ae93fb8e4777",
      "number": "PO-2026-00048",
      "status": "IN_PROGRESS"
    },
    {
      "id": "78149c38-b0c4-48e8-9c8f-95d637647a4c",
      "number": "PO-2026-00009",
      "status": "READY_FOR_DELIVERY"
    },
    {
      "id": "796eea36-b533-4bb5-9c90-76296881bb5b",
      "number": "PO-2026-00044",
      "status": "IN_PROGRESS"
    },
    {
      "id": "7a8ea86f-d95d-4725-97d0-61da88623a09",
      "number": "PO-2026-00047",
      "status": "IN_PROGRESS"
    },
    {
      "id": "7b83d08b-018a-4012-bb95-0599764587ca",
      "number": "PO-2026-00021",
      "status": "IN_PROGRESS"
    },
    {
      "id": "834a1c44-b263-4b43-8127-14d3fa5f486a",
      "number": "PO-2026-00013",
      "status": "IN_PROGRESS"
    },
    {
      "id": "8f9d987d-7cda-44ce-8946-d7739901cde4",
      "number": "PO-2026-00056",
      "status": "IN_PROGRESS"
    },
    {
      "id": "a0817683-31e2-4b9a-b2c0-4be25c52db76",
      "number": "PO-2026-00031",
      "status": "IN_PROGRESS"
    },
    {
      "id": "a5372cd0-6d45-4669-be7d-e53b0b0f8ba0",
      "number": "PO-2026-00049",
      "status": "IN_PROGRESS"
    },
    {
      "id": "b5ab30a4-a11c-4d54-8427-f7c34aa7fa38",
      "number": "PO-2026-00005",
      "status": "IN_PROGRESS"
    },
    {
      "id": "b75a1330-fb2b-4cdf-a4ca-aff13e3d6a64",
      "number": "PO-2026-00033",
      "status": "IN_PROGRESS"
    },
    {
      "id": "b8dc1aba-e2cc-487f-b1b8-bc7c08c275bf",
      "number": "PO-2026-00008",
      "status": "IN_PROGRESS"
    },
    {
      "id": "d9754b55-07a3-4268-9ad3-cece7871bebb",
      "number": "PO-2026-00029",
      "status": "IN_PROGRESS"
    },
    {
      "id": "d9fedde1-9fff-4439-a63a-b7e118ee2c15",
      "number": "PO-2026-00012",
      "status": "IN_PROGRESS"
    },
    {
      "id": "da38dc58-2b79-4e04-aef0-8f32eab2bc34",
      "number": "PO-2026-00042",
      "status": "IN_PROGRESS"
    }
  ],
  "orders": {
    "earliest": {
      "productionOrderId": "e727b44f-d1d7-4d5f-9ab6-17cde461ddd4",
      "number": "PO-2026-00142",
      "priority": "NORMAL",
      "requestedDeliveryDate": null,
      "suggestedDeliveryDate": "2026-08-29T16:11:00.000Z",
      "committedDeliveryDate": null,
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-08-29T16:11:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "5f6e9b41-193d-42ec-81d4-080d678f0fe7",
          "stage": "Material preparation",
          "worker": "Anas Freijat",
          "workerId": "056ffba1-06c7-4502-aeec-ec0e009d31b8",
          "plannedStart": "2026-08-29T05:00:00.000Z",
          "plannedEnd": "2026-08-29T05:40:00.000Z",
          "pinned": false
        },
        {
          "id": "ab6521a0-96d8-4a6a-bc22-bf7ab8567b4f",
          "stage": "Carpentry",
          "worker": "Fadi Saleh",
          "workerId": "2b1ae2fe-66ea-4bdd-b5ed-80b957b69216",
          "plannedStart": "2026-08-29T06:00:00.000Z",
          "plannedEnd": "2026-08-29T06:40:00.000Z",
          "pinned": false
        },
        {
          "id": "b0691f1f-4ccc-4be2-ad94-776e04dfaf23",
          "stage": "Painting",
          "worker": "Sami Nasser",
          "workerId": "b8a924e0-8989-434e-8c7f-eb6d959b15f5",
          "plannedStart": "2026-08-29T06:00:00.000Z",
          "plannedEnd": "2026-08-29T06:40:00.000Z",
          "pinned": false
        },
        {
          "id": "2fed0c04-0105-47f1-ae71-0bf6a2d2e134",
          "stage": "Foam preparation",
          "worker": "Yousef Haddad",
          "workerId": "3b62a01a-d3ca-4f7d-877c-b6369beaa468",
          "plannedStart": "2026-08-29T06:59:00.000Z",
          "plannedEnd": "2026-08-29T07:39:00.000Z",
          "pinned": false
        },
        {
          "id": "e5601929-8c29-4155-9ace-413d979cc9de",
          "stage": "Upholstery",
          "worker": "Tareq Zabin",
          "workerId": "d9296df9-7f9d-49cc-ac8d-7fa604b8028e",
          "plannedStart": "2026-08-29T10:57:00.000Z",
          "plannedEnd": "2026-08-29T11:37:00.000Z",
          "pinned": false
        },
        {
          "id": "20e5f5ce-a8cc-43eb-846c-56a4bc6082e7",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-08-29T12:05:00.000Z",
          "plannedEnd": "2026-08-29T12:45:00.000Z",
          "pinned": false
        },
        {
          "id": "b77c2e2c-d595-463d-a489-ffeec31fa2b0",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-08-29T12:59:00.000Z",
          "plannedEnd": "2026-08-29T13:39:00.000Z",
          "pinned": false
        },
        {
          "id": "38044845-cc50-4444-bf8f-3706de0b32b5",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-08-29T13:39:00.000Z",
          "plannedEnd": "2026-08-29T14:19:00.000Z",
          "pinned": false
        },
        {
          "id": "a92b7ce0-4717-4de7-8afa-e67e59b1cb18",
          "stage": "Delivery",
          "worker": "Omar Hijazi",
          "workerId": "d3e379ff-21ad-4941-b279-b037948d684c",
          "plannedStart": "2026-08-29T15:31:00.000Z",
          "plannedEnd": "2026-08-29T16:11:00.000Z",
          "pinned": false
        }
      ]
    },
    "atRisk": {
      "productionOrderId": "fd7aa9aa-5c66-4170-9150-7baecf3ac1a3",
      "number": "PO-2026-00143",
      "priority": "HIGH",
      "requestedDeliveryDate": "2026-08-20T16:00:00.000Z",
      "suggestedDeliveryDate": "2026-09-01T08:23:00.000Z",
      "committedDeliveryDate": "2026-08-23T16:00:00.000Z",
      "riskStatus": "AT_RISK",
      "planningMode": "BACKWARD_FALLBACK_FORWARD",
      "projectedCompletion": "2026-09-01T08:23:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "597dfd62-35d9-4f57-a7aa-3ab56a20a2c9",
          "stage": "Material preparation",
          "worker": "Khaled Obeid",
          "workerId": "0f551547-7823-4bff-ab84-f49ac2f8e82f",
          "plannedStart": "2026-08-29T05:00:00.000Z",
          "plannedEnd": "2026-08-29T06:00:00.000Z",
          "pinned": false
        },
        {
          "id": "fb3fb418-7b73-459c-9445-e1245011145f",
          "stage": "Carpentry",
          "worker": "Basel Smadi",
          "workerId": "bff45706-c927-44da-ba1e-e01f726e470a",
          "plannedStart": "2026-08-29T07:43:00.000Z",
          "plannedEnd": "2026-08-29T08:43:00.000Z",
          "pinned": false
        },
        {
          "id": "c93a0781-c8b9-4445-86cb-2268a0440456",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-08-29T11:01:00.000Z",
          "plannedEnd": "2026-08-29T12:01:00.000Z",
          "pinned": false
        },
        {
          "id": "3cf57791-f707-4660-8c28-cf676477818e",
          "stage": "Painting",
          "worker": "Sami Nasser",
          "workerId": "b8a924e0-8989-434e-8c7f-eb6d959b15f5",
          "plannedStart": "2026-08-29T11:45:00.000Z",
          "plannedEnd": "2026-08-29T12:45:00.000Z",
          "pinned": false
        },
        {
          "id": "dd65540a-9af4-444b-a241-041698e239a0",
          "stage": "Upholstery",
          "worker": "Tareq Zabin",
          "workerId": "d9296df9-7f9d-49cc-ac8d-7fa604b8028e",
          "plannedStart": "2026-08-31T06:27:00.000Z",
          "plannedEnd": "2026-08-31T07:27:00.000Z",
          "pinned": false
        },
        {
          "id": "12e51bce-1dc3-4ea2-9a45-343e62bc3dcf",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-08-31T12:23:00.000Z",
          "plannedEnd": "2026-09-01T05:23:00.000Z",
          "pinned": false
        },
        {
          "id": "311bdccc-eb29-44c3-9a66-f7469581b87c",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-01T05:23:00.000Z",
          "plannedEnd": "2026-09-01T06:23:00.000Z",
          "pinned": false
        },
        {
          "id": "c41f4ce6-3c3a-48fb-bc64-532f61e2841d",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-01T06:23:00.000Z",
          "plannedEnd": "2026-09-01T07:23:00.000Z",
          "pinned": false
        },
        {
          "id": "01f3bf4e-3e42-4260-8df2-ca0e6bff7fe8",
          "stage": "Delivery",
          "worker": "Omar Hijazi",
          "workerId": "d3e379ff-21ad-4941-b279-b037948d684c",
          "plannedStart": "2026-09-01T07:23:00.000Z",
          "plannedEnd": "2026-09-01T08:23:00.000Z",
          "pinned": false
        }
      ]
    },
    "healthy": {
      "productionOrderId": "ba3597dd-60a8-4896-b1cf-99014bac8323",
      "number": "PO-2026-00144",
      "priority": "NORMAL",
      "requestedDeliveryDate": "2026-10-22T16:00:00.000Z",
      "suggestedDeliveryDate": "2026-10-22T16:00:00.000Z",
      "committedDeliveryDate": "2026-10-22T16:00:00.000Z",
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "BACKWARD",
      "projectedCompletion": "2026-10-21T12:24:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "e3018fb2-81ac-4c57-abe9-dc95466c4d3f",
          "stage": "Material preparation",
          "worker": "Khaled Obeid",
          "workerId": "0f551547-7823-4bff-ab84-f49ac2f8e82f",
          "plannedStart": "2026-10-21T06:04:00.000Z",
          "plannedEnd": "2026-10-21T06:44:00.000Z",
          "pinned": false
        },
        {
          "id": "13538b5c-1043-4ccf-ba72-e3b70a8b0039",
          "stage": "Carpentry",
          "worker": "Fadi Saleh",
          "workerId": "2b1ae2fe-66ea-4bdd-b5ed-80b957b69216",
          "plannedStart": "2026-10-21T06:44:00.000Z",
          "plannedEnd": "2026-10-21T07:24:00.000Z",
          "pinned": false
        },
        {
          "id": "7626b43b-41f4-4723-9a35-a8536bd5a792",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-10-21T07:24:00.000Z",
          "plannedEnd": "2026-10-21T08:04:00.000Z",
          "pinned": false
        },
        {
          "id": "bead2959-1ae9-40a2-9e48-72e248067a0c",
          "stage": "Painting",
          "worker": "Issa Daoud",
          "workerId": "002357c5-33d6-4dff-8fc7-0879380241fb",
          "plannedStart": "2026-10-21T07:24:00.000Z",
          "plannedEnd": "2026-10-21T08:04:00.000Z",
          "pinned": false
        },
        {
          "id": "7cdd2832-85e4-459f-aeb9-52f36a5812d8",
          "stage": "Upholstery",
          "worker": "Yousef Haddad",
          "workerId": "3b62a01a-d3ca-4f7d-877c-b6369beaa468",
          "plannedStart": "2026-10-21T08:04:00.000Z",
          "plannedEnd": "2026-10-21T08:44:00.000Z",
          "pinned": false
        },
        {
          "id": "e487c6ce-278f-4316-8a22-649fcc485da6",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-10-21T08:44:00.000Z",
          "plannedEnd": "2026-10-21T10:24:00.000Z",
          "pinned": false
        },
        {
          "id": "647317e4-1cfb-4b82-ba8c-041b740057a5",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-10-21T10:24:00.000Z",
          "plannedEnd": "2026-10-21T11:04:00.000Z",
          "pinned": false
        },
        {
          "id": "a4185c7c-6efe-43e2-a9cc-6dafaf699fe9",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-10-21T11:04:00.000Z",
          "plannedEnd": "2026-10-21T11:44:00.000Z",
          "pinned": false
        },
        {
          "id": "567029bb-6819-4278-8f80-63be4a3d7e7c",
          "stage": "Delivery",
          "worker": "Omar Hijazi",
          "workerId": "d3e379ff-21ad-4941-b279-b037948d684c",
          "plannedStart": "2026-10-21T11:44:00.000Z",
          "plannedEnd": "2026-10-21T12:24:00.000Z",
          "pinned": false
        }
      ]
    },
    "closeUnpinned": {
      "productionOrderId": "64c107df-562d-4404-a654-977e8e3df2f8",
      "number": "PO-2026-00145",
      "priority": "NORMAL",
      "requestedDeliveryDate": null,
      "suggestedDeliveryDate": "2026-09-01T07:10:00.000Z",
      "committedDeliveryDate": null,
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-01T07:10:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "0e05d8ee-eeba-4369-b354-14f553820603",
          "stage": "Material preparation",
          "worker": "Anas Freijat",
          "workerId": "056ffba1-06c7-4502-aeec-ec0e009d31b8",
          "plannedStart": "2026-08-29T05:40:00.000Z",
          "plannedEnd": "2026-08-29T06:20:00.000Z",
          "pinned": false
        },
        {
          "id": "3040a167-03b7-4b09-986f-fd2b0c7bcb64",
          "stage": "Carpentry",
          "worker": "Basel Smadi",
          "workerId": "bff45706-c927-44da-ba1e-e01f726e470a",
          "plannedStart": "2026-08-29T08:43:00.000Z",
          "plannedEnd": "2026-08-29T10:23:00.000Z",
          "pinned": false
        },
        {
          "id": "92af8863-4fba-42da-9325-5a5e3744d03a",
          "stage": "Painting",
          "worker": "Sami Nasser",
          "workerId": "b8a924e0-8989-434e-8c7f-eb6d959b15f5",
          "plannedStart": "2026-08-29T10:54:00.000Z",
          "plannedEnd": "2026-08-29T11:34:00.000Z",
          "pinned": false
        },
        {
          "id": "179d552e-5830-467e-a98b-d777196f6fcf",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-08-29T12:01:00.000Z",
          "plannedEnd": "2026-08-29T12:41:00.000Z",
          "pinned": false
        },
        {
          "id": "5cff5f92-f512-40a0-9de9-010041a1429c",
          "stage": "Upholstery",
          "worker": "Yousef Haddad",
          "workerId": "3b62a01a-d3ca-4f7d-877c-b6369beaa468",
          "plannedStart": "2026-08-29T16:52:00.000Z",
          "plannedEnd": "2026-08-30T05:32:00.000Z",
          "pinned": false
        },
        {
          "id": "57d4983d-2991-4cb9-bc3b-4f624b7fa611",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-08-30T11:46:00.000Z",
          "plannedEnd": "2026-08-30T12:26:00.000Z",
          "pinned": false
        },
        {
          "id": "4e02d81e-64e9-4039-b3ee-1895b81bd369",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-08-31T07:45:00.000Z",
          "plannedEnd": "2026-08-31T08:25:00.000Z",
          "pinned": false
        },
        {
          "id": "2a10a1ad-9938-460b-bfc1-d00657701647",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-01T05:30:00.000Z",
          "plannedEnd": "2026-09-01T06:10:00.000Z",
          "pinned": false
        },
        {
          "id": "1594dd2d-736f-480d-b725-c5b2977a63e3",
          "stage": "Delivery",
          "worker": "Omar Hijazi",
          "workerId": "d3e379ff-21ad-4941-b279-b037948d684c",
          "plannedStart": "2026-09-01T06:30:00.000Z",
          "plannedEnd": "2026-09-01T07:10:00.000Z",
          "pinned": false
        }
      ]
    },
    "overtimeWork": {
      "productionOrderId": "e1db7d68-9115-4029-8cbc-7712e733e8ae",
      "number": "PO-2026-00146",
      "priority": "NORMAL",
      "requestedDeliveryDate": null,
      "suggestedDeliveryDate": "2026-09-01T10:23:00.000Z",
      "committedDeliveryDate": null,
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-01T10:23:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "6a0a3802-a963-4681-99f5-7ab17ee25bd2",
          "stage": "Material preparation",
          "worker": "Khaled Obeid",
          "workerId": "0f551547-7823-4bff-ab84-f49ac2f8e82f",
          "plannedStart": "2026-08-29T06:00:00.000Z",
          "plannedEnd": "2026-08-29T07:00:00.000Z",
          "pinned": false
        },
        {
          "id": "15319ddd-a681-4dcc-80bf-30213fa48df8",
          "stage": "Carpentry",
          "worker": "Basel Smadi",
          "workerId": "bff45706-c927-44da-ba1e-e01f726e470a",
          "plannedStart": "2026-08-29T10:23:00.000Z",
          "plannedEnd": "2026-08-29T11:23:00.000Z",
          "pinned": false
        },
        {
          "id": "06a30d26-0edb-4320-ba91-ed9f6eea5b75",
          "stage": "Painting",
          "worker": "Sami Nasser",
          "workerId": "b8a924e0-8989-434e-8c7f-eb6d959b15f5",
          "plannedStart": "2026-08-29T12:45:00.000Z",
          "plannedEnd": "2026-08-29T13:45:00.000Z",
          "pinned": false
        },
        {
          "id": "9129ea9b-a4ca-4300-8482-3941e5dab2a5",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-08-29T14:52:00.000Z",
          "plannedEnd": "2026-08-29T15:52:00.000Z",
          "pinned": false
        },
        {
          "id": "7da14fa2-e94f-4720-84b6-4b05d2a8f7d0",
          "stage": "Upholstery",
          "worker": "Tareq Zabin",
          "workerId": "d9296df9-7f9d-49cc-ac8d-7fa604b8028e",
          "plannedStart": "2026-08-31T07:27:00.000Z",
          "plannedEnd": "2026-08-31T08:27:00.000Z",
          "pinned": false
        },
        {
          "id": "c226b5ba-8fb5-44c5-8e5e-7f44476a2774",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-09-01T05:23:00.000Z",
          "plannedEnd": "2026-09-01T06:23:00.000Z",
          "pinned": false
        },
        {
          "id": "d0e69972-3df9-4add-b9c2-8af754ed9cce",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-01T06:23:00.000Z",
          "plannedEnd": "2026-09-01T07:23:00.000Z",
          "pinned": false
        },
        {
          "id": "a25c6f97-b023-4d0e-9ef4-0c6afaec5b85",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-01T07:23:00.000Z",
          "plannedEnd": "2026-09-01T08:23:00.000Z",
          "pinned": false
        },
        {
          "id": "eabf48a0-0a9c-4c9c-809d-318b8ad082de",
          "stage": "Delivery",
          "worker": "Omar Hijazi",
          "workerId": "d3e379ff-21ad-4941-b279-b037948d684c",
          "plannedStart": "2026-09-01T08:23:00.000Z",
          "plannedEnd": "2026-09-01T10:23:00.000Z",
          "pinned": false
        }
      ]
    },
    "pinnedClose": {
      "productionOrderId": "7bbe4501-0943-4d66-9b78-c9c2f6d5ee53",
      "number": "PO-2026-00147",
      "priority": "NORMAL",
      "requestedDeliveryDate": null,
      "suggestedDeliveryDate": "2026-09-02T05:36:00.000Z",
      "committedDeliveryDate": null,
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-02T05:36:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "906aa575-c1f9-4272-844b-3bd60511a5db",
          "stage": "Material preparation",
          "worker": "Anas Freijat",
          "workerId": "056ffba1-06c7-4502-aeec-ec0e009d31b8",
          "plannedStart": "2026-08-29T06:20:00.000Z",
          "plannedEnd": "2026-08-29T07:00:00.000Z",
          "pinned": true
        },
        {
          "id": "68879bb9-1075-4ef5-9b46-6d6fe3edfb66",
          "stage": "Carpentry",
          "worker": "Basel Smadi",
          "workerId": "bff45706-c927-44da-ba1e-e01f726e470a",
          "plannedStart": "2026-08-29T11:23:00.000Z",
          "plannedEnd": "2026-08-29T12:03:00.000Z",
          "pinned": false
        },
        {
          "id": "76b4d4cd-6f90-4dc3-bd7f-acca96a5438f",
          "stage": "Painting",
          "worker": "Sami Nasser",
          "workerId": "b8a924e0-8989-434e-8c7f-eb6d959b15f5",
          "plannedStart": "2026-08-29T13:45:00.000Z",
          "plannedEnd": "2026-08-29T14:25:00.000Z",
          "pinned": false
        },
        {
          "id": "383e7115-577f-4343-8144-e8b2e1e2a2c7",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-08-30T10:21:00.000Z",
          "plannedEnd": "2026-08-30T11:01:00.000Z",
          "pinned": false
        },
        {
          "id": "2a0b3d01-ecf8-4564-9996-b026653ef2c4",
          "stage": "Upholstery",
          "worker": "Yousef Haddad",
          "workerId": "3b62a01a-d3ca-4f7d-877c-b6369beaa468",
          "plannedStart": "2026-08-30T12:35:00.000Z",
          "plannedEnd": "2026-08-31T05:15:00.000Z",
          "pinned": false
        },
        {
          "id": "e6ec5236-e5f9-4a68-98fc-377ffabb4fe7",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-09-01T10:34:00.000Z",
          "plannedEnd": "2026-09-01T11:14:00.000Z",
          "pinned": false
        },
        {
          "id": "29fd3e14-7d3b-406a-aad1-24bd760f78f7",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-01T11:14:00.000Z",
          "plannedEnd": "2026-09-01T11:54:00.000Z",
          "pinned": false
        },
        {
          "id": "8aeb4a7e-19b8-4b02-9f25-dab9d4c14c4f",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-01T12:16:00.000Z",
          "plannedEnd": "2026-09-01T12:56:00.000Z",
          "pinned": false
        },
        {
          "id": "7c9a48e8-be2b-4c97-8c62-be313f5a0c28",
          "stage": "Delivery",
          "worker": "Yousef Haddad",
          "workerId": "3b62a01a-d3ca-4f7d-877c-b6369beaa468",
          "plannedStart": "2026-09-01T12:56:00.000Z",
          "plannedEnd": "2026-09-02T05:36:00.000Z",
          "pinned": false
        }
      ]
    },
    "prioHigh": {
      "productionOrderId": "5e3a4053-e032-4131-bfd8-55257e03535b",
      "number": "PO-2026-00148",
      "priority": "HIGH",
      "requestedDeliveryDate": "2026-08-26T16:00:00.000Z",
      "suggestedDeliveryDate": "2026-09-02T12:58:00.000Z",
      "committedDeliveryDate": "2026-08-26T16:00:00.000Z",
      "riskStatus": "AT_RISK",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-02T12:58:00.000Z",
      "scheduleVersion": 1,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "9d2d4d7a-99da-482d-8aa7-10c5ba389bba",
          "stage": "Material preparation",
          "worker": "Anas Freijat",
          "workerId": "056ffba1-06c7-4502-aeec-ec0e009d31b8",
          "plannedStart": "2026-08-29T08:00:00.000Z",
          "plannedEnd": "2026-08-29T09:00:00.000Z",
          "pinned": false
        },
        {
          "id": "99db5d5f-b88e-412f-8240-30764ae2e26f",
          "stage": "Carpentry",
          "worker": "Basel Smadi",
          "workerId": "bff45706-c927-44da-ba1e-e01f726e470a",
          "plannedStart": "2026-08-29T13:43:00.000Z",
          "plannedEnd": "2026-08-29T14:43:00.000Z",
          "pinned": false
        },
        {
          "id": "e43184b7-11a3-448f-8027-eb5757b094a4",
          "stage": "Painting",
          "worker": "Sami Nasser",
          "workerId": "b8a924e0-8989-434e-8c7f-eb6d959b15f5",
          "plannedStart": "2026-08-30T05:50:00.000Z",
          "plannedEnd": "2026-08-30T06:50:00.000Z",
          "pinned": false
        },
        {
          "id": "e56fb18b-ae5b-458a-966e-01643f5c0f2c",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-09-01T10:05:00.000Z",
          "plannedEnd": "2026-09-01T11:05:00.000Z",
          "pinned": false
        },
        {
          "id": "fbff2f18-fe47-40d3-80ff-8134be3059f2",
          "stage": "Upholstery",
          "worker": "Tareq Zabin",
          "workerId": "d9296df9-7f9d-49cc-ac8d-7fa604b8028e",
          "plannedStart": "2026-09-01T11:48:00.000Z",
          "plannedEnd": "2026-09-01T12:48:00.000Z",
          "pinned": false
        },
        {
          "id": "fbe999fb-037b-426e-96e0-e1607a77a1f5",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-09-02T07:58:00.000Z",
          "plannedEnd": "2026-09-02T08:58:00.000Z",
          "pinned": false
        },
        {
          "id": "ec73f887-fec5-4a6a-9b61-509405b9caa7",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-02T08:58:00.000Z",
          "plannedEnd": "2026-09-02T10:58:00.000Z",
          "pinned": false
        },
        {
          "id": "c41ef20f-bbe5-4cd5-9360-e53bf9b1ff0e",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-02T10:58:00.000Z",
          "plannedEnd": "2026-09-02T11:58:00.000Z",
          "pinned": false
        },
        {
          "id": "6dc2ac37-105a-419d-87ce-6aa49cf76bad",
          "stage": "Delivery",
          "worker": "Omar Hijazi",
          "workerId": "d3e379ff-21ad-4941-b279-b037948d684c",
          "plannedStart": "2026-09-02T11:58:00.000Z",
          "plannedEnd": "2026-09-02T12:58:00.000Z",
          "pinned": false
        }
      ]
    },
    "prioNorm": {
      "productionOrderId": "548dc404-36f8-4901-a18a-585298159c59",
      "number": "PO-2026-00149",
      "priority": "NORMAL",
      "requestedDeliveryDate": "2026-08-29T16:00:00.000Z",
      "suggestedDeliveryDate": "2026-09-03T05:58:00.000Z",
      "committedDeliveryDate": "2026-08-29T16:00:00.000Z",
      "riskStatus": "AT_RISK",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-03T05:58:00.000Z",
      "scheduleVersion": 1,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "b78a7ad6-3141-4972-a6b2-6cb3cd5ac34f",
          "stage": "Material preparation",
          "worker": "Khaled Obeid",
          "workerId": "0f551547-7823-4bff-ab84-f49ac2f8e82f",
          "plannedStart": "2026-08-29T08:00:00.000Z",
          "plannedEnd": "2026-08-29T09:00:00.000Z",
          "pinned": false
        },
        {
          "id": "c77bc0de-f1d7-423c-986a-3349f2e3c8a0",
          "stage": "Carpentry",
          "worker": "Fadi Saleh",
          "workerId": "2b1ae2fe-66ea-4bdd-b5ed-80b957b69216",
          "plannedStart": "2026-08-29T13:44:00.000Z",
          "plannedEnd": "2026-08-29T14:44:00.000Z",
          "pinned": false
        },
        {
          "id": "32033561-496b-4b71-80c2-76b263814e12",
          "stage": "Painting",
          "worker": "Sami Nasser",
          "workerId": "b8a924e0-8989-434e-8c7f-eb6d959b15f5",
          "plannedStart": "2026-08-30T06:50:00.000Z",
          "plannedEnd": "2026-08-30T07:50:00.000Z",
          "pinned": false
        },
        {
          "id": "951231b9-f1f1-4b43-883a-a79b27c9b540",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-09-01T11:05:00.000Z",
          "plannedEnd": "2026-09-01T12:05:00.000Z",
          "pinned": false
        },
        {
          "id": "c01445b3-e897-42b4-a252-59bd5f9e484e",
          "stage": "Upholstery",
          "worker": "Tareq Zabin",
          "workerId": "d9296df9-7f9d-49cc-ac8d-7fa604b8028e",
          "plannedStart": "2026-09-01T12:48:00.000Z",
          "plannedEnd": "2026-09-02T05:48:00.000Z",
          "pinned": false
        },
        {
          "id": "a9136220-2989-4ab0-a44f-7e2fdbb83e1a",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-09-02T08:58:00.000Z",
          "plannedEnd": "2026-09-02T10:58:00.000Z",
          "pinned": false
        },
        {
          "id": "4d404cac-57ab-4f71-b609-26cf654eacf6",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-02T10:58:00.000Z",
          "plannedEnd": "2026-09-02T11:58:00.000Z",
          "pinned": false
        },
        {
          "id": "87b9ec6a-1870-4722-ac53-8ce49e44d348",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-02T11:58:00.000Z",
          "plannedEnd": "2026-09-02T12:58:00.000Z",
          "pinned": false
        },
        {
          "id": "b8a99497-75f8-4522-a4bc-9492cf158371",
          "stage": "Delivery",
          "worker": "Omar Hijazi",
          "workerId": "d3e379ff-21ad-4941-b279-b037948d684c",
          "plannedStart": "2026-09-02T12:58:00.000Z",
          "plannedEnd": "2026-09-03T05:58:00.000Z",
          "pinned": false
        }
      ]
    },
    "material": {
      "productionOrderId": "ddfa7e4c-535d-43ea-99fc-3b6ecabd6ba1",
      "number": "PO-2026-00150",
      "priority": "NORMAL",
      "requestedDeliveryDate": null,
      "suggestedDeliveryDate": "2026-09-02T06:16:00.000Z",
      "committedDeliveryDate": null,
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-02T06:16:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "ea14da20-c76f-4658-b060-9ea8985e5eab",
          "stage": "Material preparation",
          "worker": "Anas Freijat",
          "workerId": "056ffba1-06c7-4502-aeec-ec0e009d31b8",
          "plannedStart": "2026-08-29T07:00:00.000Z",
          "plannedEnd": "2026-08-29T07:40:00.000Z",
          "pinned": false
        },
        {
          "id": "9db56f99-eaa0-436e-8c58-9832f26e3302",
          "stage": "Carpentry",
          "worker": "Basel Smadi",
          "workerId": "bff45706-c927-44da-ba1e-e01f726e470a",
          "plannedStart": "2026-08-29T12:03:00.000Z",
          "plannedEnd": "2026-08-29T12:43:00.000Z",
          "pinned": false
        },
        {
          "id": "a460b140-0083-4994-80e3-d60e046ac461",
          "stage": "Painting",
          "worker": "Sami Nasser",
          "workerId": "b8a924e0-8989-434e-8c7f-eb6d959b15f5",
          "plannedStart": "2026-08-29T14:25:00.000Z",
          "plannedEnd": "2026-08-29T15:05:00.000Z",
          "pinned": false
        },
        {
          "id": "4bd21177-92c6-4b14-897f-0c95f4f0d1a3",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-08-30T11:01:00.000Z",
          "plannedEnd": "2026-08-30T11:41:00.000Z",
          "pinned": false
        },
        {
          "id": "f67795f4-8a92-4814-9055-107746402a93",
          "stage": "Upholstery",
          "worker": "Tareq Zabin",
          "workerId": "d9296df9-7f9d-49cc-ac8d-7fa604b8028e",
          "plannedStart": "2026-09-01T06:48:00.000Z",
          "plannedEnd": "2026-09-01T07:28:00.000Z",
          "pinned": false
        },
        {
          "id": "05a748f4-6a4e-45e2-bbac-99e3f6441f82",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-09-01T11:14:00.000Z",
          "plannedEnd": "2026-09-01T11:54:00.000Z",
          "pinned": false
        },
        {
          "id": "b5956860-ec20-49e9-bb92-979eea289a92",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-01T11:54:00.000Z",
          "plannedEnd": "2026-09-01T12:34:00.000Z",
          "pinned": false
        },
        {
          "id": "abb2a613-d982-4b57-9b0d-151307d0b1fa",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-01T12:56:00.000Z",
          "plannedEnd": "2026-09-02T05:36:00.000Z",
          "pinned": false
        },
        {
          "id": "69e2f469-6c96-40d3-8017-30dbd3671834",
          "stage": "Delivery",
          "worker": "Yousef Haddad",
          "workerId": "3b62a01a-d3ca-4f7d-877c-b6369beaa468",
          "plannedStart": "2026-09-02T05:36:00.000Z",
          "plannedEnd": "2026-09-02T06:16:00.000Z",
          "pinned": false
        }
      ]
    },
    "wip": {
      "productionOrderId": "4bc09bfa-6906-4cc6-a36a-a0a416bcbbd5",
      "number": "PO-2026-00151",
      "priority": "NORMAL",
      "requestedDeliveryDate": null,
      "suggestedDeliveryDate": "2026-09-01T10:28:00.000Z",
      "committedDeliveryDate": null,
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-01T10:28:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "57138b91-1c36-46db-b1bc-b607bfea1a42",
          "stage": "Material preparation",
          "worker": "Khaled Obeid",
          "workerId": "0f551547-7823-4bff-ab84-f49ac2f8e82f",
          "plannedStart": "2026-08-29T07:00:00.000Z",
          "plannedEnd": "2026-08-29T07:40:00.000Z",
          "pinned": false
        },
        {
          "id": "6bbc49e6-4ec4-44d2-a74c-cf1d2ab1033d",
          "stage": "Carpentry",
          "worker": "Basel Smadi",
          "workerId": "bff45706-c927-44da-ba1e-e01f726e470a",
          "plannedStart": "2026-08-29T12:43:00.000Z",
          "plannedEnd": "2026-08-29T13:23:00.000Z",
          "pinned": false
        },
        {
          "id": "d6342dcb-7f75-41f4-beee-25e66f7df09d",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-08-30T11:41:00.000Z",
          "plannedEnd": "2026-08-30T12:21:00.000Z",
          "pinned": false
        },
        {
          "id": "e08addbd-93ab-4b35-a41b-876804aff1f7",
          "stage": "Upholstery",
          "worker": "Tareq Zabin",
          "workerId": "d9296df9-7f9d-49cc-ac8d-7fa604b8028e",
          "plannedStart": "2026-09-01T07:28:00.000Z",
          "plannedEnd": "2026-09-01T08:08:00.000Z",
          "pinned": false
        },
        {
          "id": "1122fb7a-8818-46c3-83f6-fe0685aaf9e4",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-01T08:08:00.000Z",
          "plannedEnd": "2026-09-01T08:48:00.000Z",
          "pinned": false
        },
        {
          "id": "94b16ef2-9740-44c1-abed-ead037deaf0b",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-01T08:48:00.000Z",
          "plannedEnd": "2026-09-01T10:28:00.000Z",
          "pinned": false
        }
      ]
    },
    "skill": {
      "productionOrderId": "f63a55eb-a4c4-4630-8543-aadd0bc82740",
      "number": "PO-2026-00152",
      "priority": "NORMAL",
      "requestedDeliveryDate": null,
      "suggestedDeliveryDate": "2026-09-02T06:56:00.000Z",
      "committedDeliveryDate": null,
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-02T06:56:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "32784643-57fa-4d01-a1f9-2bbe21856c10",
          "stage": "Material preparation",
          "worker": "Khaled Obeid",
          "workerId": "0f551547-7823-4bff-ab84-f49ac2f8e82f",
          "plannedStart": "2026-08-29T10:00:00.000Z",
          "plannedEnd": "2026-08-29T10:40:00.000Z",
          "pinned": false
        },
        {
          "id": "e82f00f7-a74b-467c-b692-b9d37a7e8fbb",
          "stage": "Carpentry",
          "worker": "Fadi Saleh",
          "workerId": "2b1ae2fe-66ea-4bdd-b5ed-80b957b69216",
          "plannedStart": "2026-08-29T12:44:00.000Z",
          "plannedEnd": "2026-08-29T13:24:00.000Z",
          "pinned": false
        },
        {
          "id": "54298fdc-8bad-431b-ae75-bffa8c8b5e52",
          "stage": "Painting",
          "worker": "Sami Nasser",
          "workerId": "b8a924e0-8989-434e-8c7f-eb6d959b15f5",
          "plannedStart": "2026-08-29T15:05:00.000Z",
          "plannedEnd": "2026-08-29T15:45:00.000Z",
          "pinned": false
        },
        {
          "id": "2dbe455b-e588-4087-ac92-d2eb92b3c0d3",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-08-31T07:31:00.000Z",
          "plannedEnd": "2026-08-31T08:11:00.000Z",
          "pinned": false
        },
        {
          "id": "04579ce6-4596-4def-893e-b016c40a763a",
          "stage": "Upholstery",
          "worker": "Yousef Haddad",
          "workerId": "3b62a01a-d3ca-4f7d-877c-b6369beaa468",
          "plannedStart": "2026-09-01T07:33:00.000Z",
          "plannedEnd": "2026-09-01T08:13:00.000Z",
          "pinned": false
        },
        {
          "id": "9308ab29-1fc9-426a-958b-c1880db5f80e",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-09-01T11:54:00.000Z",
          "plannedEnd": "2026-09-01T12:34:00.000Z",
          "pinned": false
        },
        {
          "id": "621a0f67-f571-4de8-b188-66bc9fb10a65",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-01T12:34:00.000Z",
          "plannedEnd": "2026-09-02T05:14:00.000Z",
          "pinned": false
        },
        {
          "id": "b0ddee46-d34a-4302-aa71-6c0d076a9ce9",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-02T05:36:00.000Z",
          "plannedEnd": "2026-09-02T06:16:00.000Z",
          "pinned": false
        },
        {
          "id": "00391fce-9aa6-4866-bcdb-ce7746a797c0",
          "stage": "Delivery",
          "worker": "Omar Hijazi",
          "workerId": "d3e379ff-21ad-4941-b279-b037948d684c",
          "plannedStart": "2026-09-02T06:16:00.000Z",
          "plannedEnd": "2026-09-02T06:56:00.000Z",
          "pinned": false
        }
      ]
    },
    "parallel": {
      "productionOrderId": "85aaf128-2b67-4e2f-97e5-6b70cb3fa1f8",
      "number": "PO-2026-00153",
      "priority": "NORMAL",
      "requestedDeliveryDate": null,
      "suggestedDeliveryDate": "2026-09-02T06:56:00.000Z",
      "committedDeliveryDate": null,
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-02T06:56:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "ff27c71c-27f3-4502-a075-d55a187d79cf",
          "stage": "Material preparation",
          "worker": "Khaled Obeid",
          "workerId": "0f551547-7823-4bff-ab84-f49ac2f8e82f",
          "plannedStart": "2026-08-29T10:40:00.000Z",
          "plannedEnd": "2026-08-29T11:20:00.000Z",
          "pinned": false
        },
        {
          "id": "8c6cd6b2-7e17-4477-8f45-ac12201d7453",
          "stage": "Carpentry",
          "worker": "Basel Smadi",
          "workerId": "bff45706-c927-44da-ba1e-e01f726e470a",
          "plannedStart": "2026-08-29T14:43:00.000Z",
          "plannedEnd": "2026-08-29T15:23:00.000Z",
          "pinned": false
        },
        {
          "id": "70843051-c84d-4ce9-a28c-faf77d3c727a",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-08-31T08:11:00.000Z",
          "plannedEnd": "2026-08-31T08:51:00.000Z",
          "pinned": false
        },
        {
          "id": "5812ed30-0e7e-4148-a6c6-4b5794c4dae7",
          "stage": "Upholstery",
          "worker": "Tareq Zabin",
          "workerId": "d9296df9-7f9d-49cc-ac8d-7fa604b8028e",
          "plannedStart": "2026-09-01T08:08:00.000Z",
          "plannedEnd": "2026-09-01T08:48:00.000Z",
          "pinned": false
        },
        {
          "id": "f89fafef-2197-45a7-85f2-6962e141f78a",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-01T08:48:00.000Z",
          "plannedEnd": "2026-09-01T10:28:00.000Z",
          "pinned": false
        },
        {
          "id": "cc8a8d48-f30d-42df-a934-d66948d7a2a8",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-02T06:16:00.000Z",
          "plannedEnd": "2026-09-02T06:56:00.000Z",
          "pinned": false
        }
      ]
    },
    "failPo": {
      "productionOrderId": "b4db53bf-1846-401a-9ca8-748e75b42b87",
      "number": "PO-2026-00154",
      "priority": "NORMAL",
      "requestedDeliveryDate": null,
      "suggestedDeliveryDate": "2026-09-02T08:40:00.000Z",
      "committedDeliveryDate": null,
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-02T08:40:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "0eadcc1c-d4cf-40f1-a14f-d46c400c8699",
          "stage": "Material preparation",
          "worker": "Anas Freijat",
          "workerId": "056ffba1-06c7-4502-aeec-ec0e009d31b8",
          "plannedStart": "2026-08-29T11:12:00.000Z",
          "plannedEnd": "2026-08-29T11:52:00.000Z",
          "pinned": false
        },
        {
          "id": "4de965d1-cefc-403b-8e6a-5696936752e9",
          "stage": "Carpentry",
          "worker": "Fadi Saleh",
          "workerId": "2b1ae2fe-66ea-4bdd-b5ed-80b957b69216",
          "plannedStart": "2026-08-29T14:44:00.000Z",
          "plannedEnd": "2026-08-29T15:24:00.000Z",
          "pinned": false
        },
        {
          "id": "7d81d898-8979-4041-8bf5-d09f9fd661b7",
          "stage": "Painting",
          "worker": "Sami Nasser",
          "workerId": "b8a924e0-8989-434e-8c7f-eb6d959b15f5",
          "plannedStart": "2026-08-29T15:45:00.000Z",
          "plannedEnd": "2026-08-29T16:25:00.000Z",
          "pinned": false
        },
        {
          "id": "3dcb3934-d745-4a88-9105-5d9dd0a113b5",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-09-01T08:05:00.000Z",
          "plannedEnd": "2026-09-01T08:45:00.000Z",
          "pinned": false
        },
        {
          "id": "a5559449-e5bd-46b0-944e-36a3edac1b2a",
          "stage": "Upholstery",
          "worker": "Tareq Zabin",
          "workerId": "d9296df9-7f9d-49cc-ac8d-7fa604b8028e",
          "plannedStart": "2026-09-01T08:48:00.000Z",
          "plannedEnd": "2026-09-01T10:28:00.000Z",
          "pinned": false
        },
        {
          "id": "725b412a-afa7-45cb-aa3f-a7a745bd182a",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-09-02T05:58:00.000Z",
          "plannedEnd": "2026-09-02T06:38:00.000Z",
          "pinned": false
        },
        {
          "id": "fd50c87d-e116-437d-bae3-f74134b90e80",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-02T06:40:00.000Z",
          "plannedEnd": "2026-09-02T07:20:00.000Z",
          "pinned": false
        },
        {
          "id": "740976e8-a492-4d18-8fa9-bdfd87a1ba94",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-02T07:20:00.000Z",
          "plannedEnd": "2026-09-02T08:00:00.000Z",
          "pinned": false
        },
        {
          "id": "d32ac798-de96-4a44-8d6c-e82f85518aa2",
          "stage": "Delivery",
          "worker": "Omar Hijazi",
          "workerId": "d3e379ff-21ad-4941-b279-b037948d684c",
          "plannedStart": "2026-09-02T08:00:00.000Z",
          "plannedEnd": "2026-09-02T08:40:00.000Z",
          "pinned": false
        }
      ]
    },
    "mix1": {
      "productionOrderId": "78ec2e37-30c5-4dcf-834e-502eade1a3b2",
      "number": "PO-2026-00155",
      "priority": "NORMAL",
      "requestedDeliveryDate": null,
      "suggestedDeliveryDate": "2026-09-05T08:09:00.000Z",
      "committedDeliveryDate": null,
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-05T08:09:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "d9c0dbf1-2b19-4cc8-be15-bf694a3379eb",
          "stage": "Material preparation",
          "worker": "Khaled Obeid",
          "workerId": "0f551547-7823-4bff-ab84-f49ac2f8e82f",
          "plannedStart": "2026-08-29T11:20:00.000Z",
          "plannedEnd": "2026-08-29T12:00:00.000Z",
          "pinned": false
        },
        {
          "id": "618c15de-b96f-4840-ba4c-9139161de7ad",
          "stage": "Carpentry",
          "worker": "Basel Smadi",
          "workerId": "bff45706-c927-44da-ba1e-e01f726e470a",
          "plannedStart": "2026-08-29T15:23:00.000Z",
          "plannedEnd": "2026-08-29T16:03:00.000Z",
          "pinned": false
        },
        {
          "id": "baa4237a-0718-489b-9254-29e070a5f8ae",
          "stage": "Painting",
          "worker": "Sami Nasser",
          "workerId": "b8a924e0-8989-434e-8c7f-eb6d959b15f5",
          "plannedStart": "2026-08-29T16:25:00.000Z",
          "plannedEnd": "2026-08-30T05:05:00.000Z",
          "pinned": false
        },
        {
          "id": "c83a99b7-2f4c-4887-a716-51ff0b0481bd",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-09-02T08:22:00.000Z",
          "plannedEnd": "2026-09-02T10:02:00.000Z",
          "pinned": false
        },
        {
          "id": "be31f0f1-4006-4294-9ffd-5ed9ab2a12de",
          "stage": "Upholstery",
          "worker": "Tareq Zabin",
          "workerId": "d9296df9-7f9d-49cc-ac8d-7fa604b8028e",
          "plannedStart": "2026-09-03T05:46:00.000Z",
          "plannedEnd": "2026-09-03T06:26:00.000Z",
          "pinned": false
        },
        {
          "id": "db4060c9-daf2-40d2-a896-dfe5f14aa564",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-09-03T08:08:00.000Z",
          "plannedEnd": "2026-09-03T08:48:00.000Z",
          "pinned": false
        },
        {
          "id": "37c6d4fc-62de-4c5c-9ff0-97ba8e8ac98f",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-03T12:06:00.000Z",
          "plannedEnd": "2026-09-03T12:46:00.000Z",
          "pinned": false
        },
        {
          "id": "cee1f56c-0976-4c5f-9967-155a46fcb7fe",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-03T12:46:00.000Z",
          "plannedEnd": "2026-09-05T05:26:00.000Z",
          "pinned": false
        },
        {
          "id": "8527bce7-b817-41cb-a958-8a6467d361e0",
          "stage": "Delivery",
          "worker": "Omar Hijazi",
          "workerId": "d3e379ff-21ad-4941-b279-b037948d684c",
          "plannedStart": "2026-09-05T07:29:00.000Z",
          "plannedEnd": "2026-09-05T08:09:00.000Z",
          "pinned": false
        }
      ]
    },
    "mix2": {
      "productionOrderId": "5e3a8d37-e38b-4806-99f1-995d870ad20c",
      "number": "PO-2026-00156",
      "priority": "NORMAL",
      "requestedDeliveryDate": null,
      "suggestedDeliveryDate": "2026-09-05T08:49:00.000Z",
      "committedDeliveryDate": null,
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-05T08:49:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "8b459c6b-acb4-4bbe-aa44-62a49d65bbf4",
          "stage": "Material preparation",
          "worker": "Anas Freijat",
          "workerId": "056ffba1-06c7-4502-aeec-ec0e009d31b8",
          "plannedStart": "2026-08-29T11:52:00.000Z",
          "plannedEnd": "2026-08-29T12:32:00.000Z",
          "pinned": false
        },
        {
          "id": "43d231fa-ded1-4864-88e3-71a3925808ff",
          "stage": "Carpentry",
          "worker": "Fadi Saleh",
          "workerId": "2b1ae2fe-66ea-4bdd-b5ed-80b957b69216",
          "plannedStart": "2026-08-29T15:24:00.000Z",
          "plannedEnd": "2026-08-29T16:04:00.000Z",
          "pinned": false
        },
        {
          "id": "f5af0e22-05a2-4e22-bce7-4b53a486bc3b",
          "stage": "Painting",
          "worker": "Sami Nasser",
          "workerId": "b8a924e0-8989-434e-8c7f-eb6d959b15f5",
          "plannedStart": "2026-08-30T05:05:00.000Z",
          "plannedEnd": "2026-08-30T05:45:00.000Z",
          "pinned": false
        },
        {
          "id": "7436fa15-6a52-46ad-b6fa-cdb883b2cb61",
          "stage": "Foam preparation",
          "worker": "Rana Khatib",
          "workerId": "7af131ad-875b-4876-987d-7c542180399a",
          "plannedStart": "2026-09-02T10:02:00.000Z",
          "plannedEnd": "2026-09-02T10:42:00.000Z",
          "pinned": false
        },
        {
          "id": "a0acea1a-f596-4fe3-9e5d-8b8cbc5a4872",
          "stage": "Upholstery",
          "worker": "Yousef Haddad",
          "workerId": "3b62a01a-d3ca-4f7d-877c-b6369beaa468",
          "plannedStart": "2026-09-03T08:22:00.000Z",
          "plannedEnd": "2026-09-03T10:02:00.000Z",
          "pinned": false
        },
        {
          "id": "ede233c1-fc32-4840-8483-5372b97bac02",
          "stage": "Assembly",
          "worker": "Majed Shawabkeh",
          "workerId": "c898cfb8-8a5f-4a6d-b417-0034015d40fc",
          "plannedStart": "2026-09-03T11:19:00.000Z",
          "plannedEnd": "2026-09-03T11:59:00.000Z",
          "pinned": false
        },
        {
          "id": "a3ace5ad-bbb9-4c27-9b6d-5d6061c31926",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-03T12:46:00.000Z",
          "plannedEnd": "2026-09-05T05:26:00.000Z",
          "pinned": false
        },
        {
          "id": "458015bf-6ff5-4061-a9be-5d10d157cdf7",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-05T05:26:00.000Z",
          "plannedEnd": "2026-09-05T06:06:00.000Z",
          "pinned": false
        },
        {
          "id": "363abf0e-a1e2-431e-9fcf-857fad074860",
          "stage": "Delivery",
          "worker": "Omar Hijazi",
          "workerId": "d3e379ff-21ad-4941-b279-b037948d684c",
          "plannedStart": "2026-09-05T08:09:00.000Z",
          "plannedEnd": "2026-09-05T08:49:00.000Z",
          "pinned": false
        }
      ]
    },
    "mix3": {
      "productionOrderId": "4994a140-0ed7-4b4d-a13f-f5855680d58b",
      "number": "PO-2026-00157",
      "priority": "NORMAL",
      "requestedDeliveryDate": null,
      "suggestedDeliveryDate": "2026-09-05T06:46:00.000Z",
      "committedDeliveryDate": null,
      "riskStatus": "AWAITING_APPROVAL",
      "planningMode": "FORWARD",
      "projectedCompletion": "2026-09-05T06:46:00.000Z",
      "scheduleVersion": 2,
      "scheduleStatus": "PROPOSED",
      "allocations": [
        {
          "id": "f8da5d8a-f4bf-4cad-80e3-3194064831c7",
          "stage": "Material preparation",
          "worker": "Khaled Obeid",
          "workerId": "0f551547-7823-4bff-ab84-f49ac2f8e82f",
          "plannedStart": "2026-08-29T12:00:00.000Z",
          "plannedEnd": "2026-08-29T12:40:00.000Z",
          "pinned": false
        },
        {
          "id": "2f59e3a1-92ab-4259-9d01-38d91ba48308",
          "stage": "Carpentry",
          "worker": "Basel Smadi",
          "workerId": "bff45706-c927-44da-ba1e-e01f726e470a",
          "plannedStart": "2026-08-29T16:03:00.000Z",
          "plannedEnd": "2026-08-29T16:43:00.000Z",
          "pinned": false
        },
        {
          "id": "b838c102-a3e6-4fae-8c66-d5cd816b1999",
          "stage": "Upholstery",
          "worker": "Tareq Zabin",
          "workerId": "d9296df9-7f9d-49cc-ac8d-7fa604b8028e",
          "plannedStart": "2026-09-01T10:28:00.000Z",
          "plannedEnd": "2026-09-01T11:08:00.000Z",
          "pinned": false
        },
        {
          "id": "043918d3-e70f-448e-a74a-d3994ba79557",
          "stage": "Inspection",
          "worker": "Lina Awad",
          "workerId": "831e6fab-5678-4427-930c-e1c295875baf",
          "plannedStart": "2026-09-02T05:14:00.000Z",
          "plannedEnd": "2026-09-02T05:54:00.000Z",
          "pinned": false
        },
        {
          "id": "2f8bb0f4-cd03-43d9-a6de-4b0ea3cd98e7",
          "stage": "Foam preparation",
          "worker": "Yousef Haddad",
          "workerId": "3b62a01a-d3ca-4f7d-877c-b6369beaa468",
          "plannedStart": "2026-09-03T12:47:00.000Z",
          "plannedEnd": "2026-09-05T05:27:00.000Z",
          "pinned": false
        },
        {
          "id": "9ffd25e8-2b23-4c42-9e0b-db656915be4f",
          "stage": "Packaging",
          "worker": "Nour Masri",
          "workerId": "8b6c3255-e6c7-4888-ac39-cd5595a36faa",
          "plannedStart": "2026-09-05T06:06:00.000Z",
          "plannedEnd": "2026-09-05T06:46:00.000Z",
          "pinned": false
        }
      ]
    }
  }
}
```
