export const cellValueUtil = {
  createCellValue: (kind, signal) => {
    const { kindId, subKindId } = {
      "None": { kindId: 0, subKindId: 0 },
      "Wire": { kindId: 1, subKindId: 0 },
      "WireCross": { kindId: 1, subKindId: 1 },
      "InAnd": { kindId: 2, subKindId: 0 },
      "InOr": { kindId: 2, subKindId: 1 },
      "InXor": { kindId: 2, subKindId: 2 },
      "Out": { kindId: 3, subKindId: 0 },
      "OutNot": { kindId: 3, subKindId: 1 },
    }[kind];
    return (kindId << 6) | (subKindId << 4) | (signal ? 0xf : 0);
  }
}
