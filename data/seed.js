/* ===================== SEED DATA (từ tệp báo cáo thực tế người dùng tải lên) ===================== */
const SEED_ORDERS = [{
  "id": "ORD001",
  "customer": "shengshing",
  "orderDate": "2025-08-10",
  "spec": "0.254BC",
  "materialCode": "B",
  "quantity": 19963,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 22989.23,
      "remain": -3026.23
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 28993.12,
      "remain": -9030.12
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD002",
  "customer": "shengshing",
  "orderDate": null,
  "spec": "0.180BC",
  "materialCode": "",
  "quantity": 210,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 212,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 211.5,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD003",
  "customer": "FOUSINE",
  "orderDate": "2026-08-05",
  "spec": "0.190BC",
  "materialCode": "HÀNG B LOẠI BIN 12INH",
  "quantity": 5283.51,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 700,
      "remain": 4583.51
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 700,
      "remain": 4583.51
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD004",
  "customer": "FOUSINE",
  "orderDate": null,
  "spec": "0.240BC",
  "materialCode": "HÀNG B LOẠI BIN 12INH",
  "quantity": 6562.65,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 3937.34,
      "remain": 2625.31
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 3937.34,
      "remain": 2625.31
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD005",
  "customer": "FOUSINE",
  "orderDate": null,
  "spec": "7/0.20BC",
  "materialCode": "HÀNG A LOẠI BỆN RỐI BIN SẮT 500",
  "quantity": 18322,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 10414.7,
      "remain": 7907.3
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 12007.33,
      "remain": 6314.67
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD006",
  "customer": "FOUSINE",
  "orderDate": null,
  "spec": "0.254BC",
  "materialCode": "HÀNG A BIN 12",
  "quantity": 1221.35,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 875,
      "remain": 346.35
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 1179.7,
      "remain": 41.65
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD007",
  "customer": "FOUSINE",
  "orderDate": null,
  "spec": "0.254BC",
  "materialCode": "HÀNG A BIN 300 CỦA KHÁCH",
  "quantity": 2200,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 1586.35,
      "remain": 613.65
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 2200
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD008",
  "customer": "FOUSINE",
  "orderDate": null,
  "spec": "0.287BC",
  "materialCode": "",
  "quantity": 1100,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 1100
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 1100
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD009",
  "customer": "FOUSINE",
  "orderDate": null,
  "spec": "0.455BC",
  "materialCode": "",
  "quantity": 313.42,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 405.45,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD010",
  "customer": "CÁP",
  "orderDate": null,
  "spec": "7/0.150BC",
  "materialCode": "B",
  "quantity": 14500,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 15959.5,
      "remain": -1459.5
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 16829.68,
      "remain": -2329.68
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 12855.14,
      "remain": 1644.86
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD011",
  "customer": "CÁP",
  "orderDate": null,
  "spec": "7/0.195",
  "materialCode": "",
  "quantity": 265,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 301.45,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 199.63,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 264.25,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD012",
  "customer": "CÁP",
  "orderDate": null,
  "spec": "11/0.160TC",
  "materialCode": "",
  "quantity": 500,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 551.14,
      "remain": 0
    },
    "ben": {
      "done": 683.4,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD013",
  "customer": "CÁP",
  "orderDate": "16-6-2026",
  "spec": "41/0.254TC",
  "materialCode": "",
  "quantity": 400,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 402.1,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD014",
  "customer": "CÁP",
  "orderDate": null,
  "spec": "11/0.160TC",
  "materialCode": "",
  "quantity": 3200,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 4531.5,
      "remain": -1331.5
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 2778.77,
      "remain": 0
    },
    "ben": {
      "done": 2328.05,
      "remain": 871.95
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD015",
  "customer": "CÁP",
  "orderDate": null,
  "spec": "7/0.127BC",
  "materialCode": "",
  "quantity": 100,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 115,
      "remain": 0
    },
    "u_nhiet": {
      "done": 86.9,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD016",
  "customer": "CÁP",
  "orderDate": null,
  "spec": "0.10TC",
  "materialCode": "",
  "quantity": 320,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 389.66,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD017",
  "customer": "CÁP",
  "orderDate": null,
  "spec": "0.120TC",
  "materialCode": "",
  "quantity": 230,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 240.08,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD018",
  "customer": "PYS",
  "orderDate": null,
  "spec": 0.25,
  "materialCode": "",
  "quantity": 8000,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 8046,
      "remain": -46
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 8014.29,
      "remain": -14.29
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD019",
  "customer": "PYS",
  "orderDate": "5-6-2026",
  "spec": 0.155,
  "materialCode": "",
  "quantity": 12400,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 13331.65,
      "remain": -931.65
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 14026.45,
      "remain": -1626.45
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD020",
  "customer": "PYS",
  "orderDate": null,
  "spec": 0.254,
  "materialCode": "",
  "quantity": 1666,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 1666,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 1727.45,
      "remain": -61.45
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD021",
  "customer": "PYS",
  "orderDate": "19-6-2026",
  "spec": 0.155,
  "materialCode": "",
  "quantity": null,
  "quantityNote": "DỰ PHÒNG",
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 4311.55,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 3168.47,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD022",
  "customer": "HÀNG XỬ LÝ ĐỂ BỌC",
  "orderDate": null,
  "spec": 0.24,
  "materialCode": "",
  "quantity": null,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 3625.3,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD023",
  "customer": "bao jia li",
  "orderDate": null,
  "spec": "47/0.148",
  "materialCode": "A",
  "quantity": 9000,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 9277.54,
      "remain": -277.54
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 8574.84,
      "remain": 425.16
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 6703.1,
      "remain": 2296.9
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD024",
  "customer": "sunlucx",
  "orderDate": null,
  "spec": "0.127TC",
  "materialCode": "",
  "quantity": 6400,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 6519.5,
      "remain": -119.5
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 5036.05,
      "remain": 1363.95
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD025",
  "customer": "BỌC",
  "orderDate": "11-6-2026",
  "spec": "0.46BC",
  "materialCode": "Bobin 630",
  "quantity": 3000,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 3000,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD026",
  "customer": "BỌC",
  "orderDate": null,
  "spec": "0.46BC",
  "materialCode": "Bobin 500",
  "quantity": 4000,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 4044.6,
      "remain": -44.6
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD027",
  "customer": "BỌC",
  "orderDate": "15-6-2026",
  "spec": "0.46BC",
  "materialCode": "Bobin 630",
  "quantity": 3000,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 1929.25,
      "remain": 1070.75
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD028",
  "customer": "BỌC",
  "orderDate": null,
  "spec": "0.46BC",
  "materialCode": "Bobin 500",
  "quantity": 4500,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 5996.53,
      "remain": -1496.53
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD029",
  "customer": "dự phòng",
  "orderDate": null,
  "spec": "0.10bc",
  "materialCode": "",
  "quantity": null,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 683.5,
      "remain": 0
    },
    "u_nhiet": {
      "done": 98.9,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD030",
  "customer": "dự phòng",
  "orderDate": null,
  "spec": "0.08bc",
  "materialCode": "",
  "quantity": null,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 580.35,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD031",
  "customer": "a tuyền",
  "orderDate": null,
  "spec": "0.176c",
  "materialCode": "dự phòng",
  "quantity": null,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 1806,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 2137.7,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD032",
  "customer": "A TIẾN BG",
  "orderDate": null,
  "spec": "0.08TC",
  "materialCode": "",
  "quantity": 300,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 0,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 63,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 337.8,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD033",
  "customer": "A HẢO",
  "orderDate": null,
  "spec": "1.26BC",
  "materialCode": "",
  "quantity": 490,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 495.15,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD034",
  "customer": "VIET HAN",
  "orderDate": null,
  "spec": "1.0BC",
  "materialCode": "K Ủ",
  "quantity": 6000,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 6033.3,
      "remain": -33.3
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD035",
  "customer": "VIET HAN",
  "orderDate": null,
  "spec": "19/0.725",
  "materialCode": "",
  "quantity": 400,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 412.45,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 200.58,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD036",
  "customer": "tailway",
  "orderDate": "18-6-2026",
  "spec": "19/0.55",
  "materialCode": "",
  "quantity": 172,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 178.9,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}, {
  "id": "ORD037",
  "customer": "tailway",
  "orderDate": null,
  "spec": "19/0.45",
  "materialCode": "",
  "quantity": 763,
  "quantityNote": null,
  "inventory": 0,
  "stages": {
    "keo_trung": {
      "done": 795,
      "remain": 0
    },
    "keo_tinh": {
      "done": 0,
      "remain": 0
    },
    "keo_sieu_tinh": {
      "done": 0,
      "remain": 0
    },
    "u_nhiet": {
      "done": 0,
      "remain": 0
    },
    "ma_thiec": {
      "done": 0,
      "remain": 0
    },
    "ben": {
      "done": 0,
      "remain": 0
    }
  },
  "finishedDone": 0,
  "finishedShort": 0
}];
const SEED_STAFF = [{
  "id": "NV001",
  "code": "D-AMG146",
  "name": "Phùng Văn Tuyến",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV002",
  "code": "D-AMG024",
  "name": "Đỗ Văn Trường",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV003",
  "code": "D-AMG049",
  "name": "Hoàng Thanh Sang",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV004",
  "code": "D-AMG 078",
  "name": "Dương văn hoàng",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV005",
  "code": "D-AMG331",
  "name": "Hoàng Văn Đức",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV006",
  "code": "D-AMG088",
  "name": "Lường Văn Tú",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV007",
  "code": "D-AMG400",
  "name": "Lê Văn Kỳ",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV008",
  "code": "D-AMG065",
  "name": "Dương Văn Tác",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV009",
  "code": "D-AMG104",
  "name": "Lục Đức Ngoãn",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV010",
  "code": "D-AMG145",
  "name": "Nguyễn Văn Thư",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV011",
  "code": "D-AMG237",
  "name": "Hoàng Trọng Được",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV012",
  "code": "D-AMG225",
  "name": "Hoàng Văn Nhân",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV013",
  "code": "D-AMG247",
  "name": "Phan Đạo Doãn",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV014",
  "code": "D-AMG342",
  "name": "Trần Văn Thưởng",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV015",
  "code": "D-AMG095",
  "name": "Trần Văn Khang",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV016",
  "code": "D-AMG403",
  "name": "Lô Văn Tài",
  "team": "KÉO",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV017",
  "code": "D-AMG0176",
  "name": "Nguyễn Quang Chiến",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV018",
  "code": "D-AMG091",
  "name": "HÀ VĂN TRƯỜNG",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV019",
  "code": "D-AMG250",
  "name": "Lục Văn Thành Đủ",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV020",
  "code": "D-AMG201",
  "name": "Lương Văn Anh",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV021",
  "code": "D-AMG271",
  "name": "Hoàng Văn Tía",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV022",
  "code": "D-AMG244",
  "name": "Lê Minh Hùng",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV023",
  "code": "D-AMG270",
  "name": "Lù Minh Quyết",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV024",
  "code": "D-AMG269",
  "name": "Bàn Thị Khoa",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV025",
  "code": "D-AMG393",
  "name": "Quàng Văn Phú",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV026",
  "code": "D-AMG089",
  "name": "Lò Văn Toàn",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV027",
  "code": "D-AMG282",
  "name": "Đoàn Văn Cảnh",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV028",
  "code": "D-AMG216",
  "name": "Bùi Anh Tuấn",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV029",
  "code": "D-AMG032",
  "name": "Phạm Văn Hưng",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV030",
  "code": "D-AMG256",
  "name": "Trương thanh Lợi",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV031",
  "code": "D-AMG394",
  "name": "Lèo Văn Chuẩn",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV032",
  "code": "D-AMG385",
  "name": "Lương Văn Tình",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV033",
  "code": "D-AMG213",
  "name": "Lục Văn Nghiềm",
  "team": "Ủ NHIỆT",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV034",
  "code": "D-AMG162",
  "name": "Nguyễn Văn Tuấn",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV035",
  "code": "D-AMG102",
  "name": "Mai Công Sinh",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV036",
  "code": "D-AMG139",
  "name": "Nguyễn Văn Thể",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV037",
  "code": "D-AMG196",
  "name": "Nông Thị Sắm",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV038",
  "code": "D-AMG276",
  "name": "Lò Thị Phương",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV039",
  "code": "D-AMG009",
  "name": "Lương Thị Linh",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV040",
  "code": "D-AMG219",
  "name": "Lò Thị Sim",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV041",
  "code": "D-AMG199",
  "name": "Cầm Bá Mạnh",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV042",
  "code": "D-AMG193",
  "name": "Lương Văn Tuấn",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV043",
  "code": "D-AMG119",
  "name": "Triệu Văn Toan",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV044",
  "code": "D-AMG147",
  "name": "Tỉnh Thị Tính",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV045",
  "code": "D-AMG203",
  "name": "Quàng Thị Thỏa",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV046",
  "code": "D-AMG392",
  "name": "Lò Thị Hiên",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV047",
  "code": "D-AMG198",
  "name": "Lò Thị Nga",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV048",
  "code": "D-AMG273",
  "name": "Nông Bích Hường",
  "team": "BỆN",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV049",
  "code": "D-AMG077",
  "name": "Lương Văn Tú",
  "team": "BỌC",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV050",
  "code": "D-AMG246",
  "name": "Triệu Ngọc Siêu",
  "team": "BỌC",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV051",
  "code": "D-AMG175",
  "name": "Nguyễn Văn Tuấn",
  "team": "BỌC",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV052",
  "code": "D-AMG126",
  "name": "Chu Văn May",
  "team": "BỌC",
  "shift": "Ca ngày",
  "status": "Đang làm"
}, {
  "id": "NV053",
  "code": "D-AMG030",
  "name": "TRIỆU VĂN GẤP",
  "team": "QĐỐC",
  "shift": "Ca ngày",
  "status": "Đang làm"
}];
const SEED_TIMESERIES = [{
  "period": "1",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 0,
  "keo_tinh": 1394485.3,
  "keo_sieu_tinh": 2358.6,
  "u_nhiet": 490535.9,
  "ma_thiec": 0,
  "ben": 9991.0
}, {
  "period": "2",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 0,
  "keo_tinh": 1394485.3,
  "keo_sieu_tinh": 2358.6,
  "u_nhiet": 490535.9,
  "ma_thiec": 0,
  "ben": 9991.0
}, {
  "period": "3",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 0,
  "keo_tinh": 1395780.6,
  "keo_sieu_tinh": 2684.9,
  "u_nhiet": 493857.6,
  "ma_thiec": 0,
  "ben": 12213.6
}, {
  "period": "4",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 2409.0,
  "keo_tinh": 1409014.8,
  "keo_sieu_tinh": 3134.7,
  "u_nhiet": 508576.8,
  "ma_thiec": 0,
  "ben": 19217.4
}, {
  "period": "5",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 1114.0,
  "keo_tinh": 1397298.1,
  "keo_sieu_tinh": 0,
  "u_nhiet": 495982.2,
  "ma_thiec": 0,
  "ben": 14088.2
}, {
  "period": "6",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 1542.7,
  "keo_tinh": 1405027.6,
  "keo_sieu_tinh": 0,
  "u_nhiet": 502591.6,
  "ma_thiec": 0,
  "ben": 16151.5
}, {
  "period": "7",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 1542.7,
  "keo_tinh": 1423110.2,
  "keo_sieu_tinh": 0,
  "u_nhiet": 517268.1,
  "ma_thiec": 0,
  "ben": 18515.4
}, {
  "period": "8",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 405.4,
  "keo_tinh": 1425665.1,
  "keo_sieu_tinh": 0,
  "u_nhiet": 522269.1,
  "ma_thiec": 0,
  "ben": 16561.5
}, {
  "period": "9",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 405.4,
  "keo_tinh": 1431989.7,
  "keo_sieu_tinh": 0,
  "u_nhiet": 527915.7,
  "ma_thiec": 0,
  "ben": 18003.5
}, {
  "period": "10",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 405.4,
  "keo_tinh": 109574.4,
  "keo_sieu_tinh": 0,
  "u_nhiet": 98973.4,
  "ma_thiec": 0,
  "ben": 19958.9
}, {
  "period": "11",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 405.4,
  "keo_tinh": 117149.4,
  "keo_sieu_tinh": 0,
  "u_nhiet": 105883.1,
  "ma_thiec": 0,
  "ben": 21217.6
}, {
  "period": "12",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 3291.8,
  "keo_tinh": 125241.9,
  "keo_sieu_tinh": 0,
  "u_nhiet": 111761.6,
  "ma_thiec": 556.0,
  "ben": 22636.7
}, {
  "period": "13",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 3291.8,
  "keo_tinh": 125241.9,
  "keo_sieu_tinh": 0,
  "u_nhiet": 111761.6,
  "ma_thiec": 556.0,
  "ben": 22636.7
}, {
  "period": "14",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 3677.8,
  "keo_tinh": 129032.5,
  "keo_sieu_tinh": 0,
  "u_nhiet": 117860.6,
  "ma_thiec": 981.9,
  "ben": 23422.4
}, {
  "period": "15",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 7193.0,
  "keo_tinh": 73576.2,
  "keo_sieu_tinh": 317.5,
  "u_nhiet": 52598.4,
  "ma_thiec": 2031.9,
  "ben": 15425.5
}, {
  "period": "16",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 8523.0,
  "keo_tinh": 80773.3,
  "keo_sieu_tinh": 317.5,
  "u_nhiet": 58654.2,
  "ma_thiec": 2867.8,
  "ben": 16214.7
}, {
  "period": "17",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 11329.3,
  "keo_tinh": 86553.8,
  "keo_sieu_tinh": 432.5,
  "u_nhiet": 64889.4,
  "ma_thiec": 3846.4,
  "ben": 17108.6
}, {
  "period": "18",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 19667.9,
  "keo_tinh": 100966.4,
  "keo_sieu_tinh": 932.8,
  "u_nhiet": 81902.0,
  "ma_thiec": 6451.7,
  "ben": 19744.6
}, {
  "period": "19",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 22574.5,
  "keo_tinh": 106738.7,
  "keo_sieu_tinh": 1160.3,
  "u_nhiet": 89122.4,
  "ma_thiec": 7464.6,
  "ben": 21217.3
}, {
  "period": "20",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 22574.5,
  "keo_tinh": 106738.7,
  "keo_sieu_tinh": 1160.3,
  "u_nhiet": 89122.4,
  "ma_thiec": 7464.6,
  "ben": 21217.3
}, {
  "period": "21",
  "totalFinished": 0,
  "totalShort": 0,
  "keo_trung": 23290.6,
  "keo_tinh": 110090.6,
  "keo_sieu_tinh": 1441.8,
  "u_nhiet": 101893.3,
  "ma_thiec": 9333.5,
  "ben": 23436.6
}];
const SEED_SCRAP = [{
  id: "PL001",
  date: todayMinus(6),
  stage: "keo_tinh",
  spec: "0.190BC",
  customer: "FOUSINE",
  qty: 12.5,
  unit: "kg",
  reason: "Đứt dây trong khi kéo",
  recordedBy: "admin"
}, {
  id: "PL002",
  date: todayMinus(5),
  stage: "u_nhiet",
  spec: "0.180BC",
  customer: "HÒA AN",
  qty: 8.2,
  unit: "kg",
  reason: "Ủ quá nhiệt, oxy hoá bề mặt",
  recordedBy: "admin"
}, {
  id: "PL003",
  date: todayMinus(4),
  stage: "ben",
  spec: "7/0.20BC",
  customer: "FOUSINE",
  qty: 21.0,
  unit: "kg",
  reason: "Lỗi bện rối, không đạt quy cách",
  recordedBy: "admin"
}, {
  id: "PL004",
  date: todayMinus(2),
  stage: "ma_thiec",
  spec: "1.05BC",
  customer: "WANMA",
  qty: 4.6,
  unit: "kg",
  reason: "Mạ không đều, tróc lớp thiếc",
  recordedBy: "admin"
}, {
  id: "PL005",
  date: todayMinus(1),
  stage: "keo_sieu_tinh",
  spec: "0.10BC",
  customer: "si yuan",
  qty: 2.1,
  unit: "kg",
  reason: "Đứt sợi do tạp chất trong nguyên liệu",
  recordedBy: "admin"
}];
function todayMinus(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
