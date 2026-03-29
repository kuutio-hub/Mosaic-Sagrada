export const state = {
    front: {
        title: "MINTA NÉV",
        difficulty: 3,
        cells: Array(20).fill(null).map(() => ({ color: '.', value: '.' }))
    },
    back: {
        title: "MINTA NÉV (HÁT)",
        difficulty: 4,
        cells: Array(20).fill(null).map(() => ({ color: '.', value: '.' }))
    },
    patternQueue: [],
    glassEffect: true
};

