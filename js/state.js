export const state = {
    front: {
        title: "MINTA NÉV",
        difficulty: 3,
        cells: Array.from({length: 20}, () => ({ color: 'none', value: '.', pattern: Math.floor(Math.random()*4) }))
    },
    back: {
        title: "MINTA NÉV (HÁT)",
        difficulty: 4,
        cells: Array.from({length: 20}, () => ({ color: 'none', value: '.', pattern: Math.floor(Math.random()*4) }))
    },
    patternQueue: []
};
