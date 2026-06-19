/* ==========================================================================
   CÓDIGO PRINCIPAL DAJOX - BANCO DE 30 PREGUNTAS PREDETERMINADAS BASE
   ========================================================================== */
const bancoPredeterminado30 = [
    { id: 101, pregunta: "¿Cuál es el componente principal encargado de ejecutar las instrucciones de cómputo?", opciones: ["Memoria RAM", "Procesador (CPU)", "Disco Duro", "Fuente de Poder"], correcta: 1, image: "" },
    { id: 102, pregunta: "Si una computadora enciende pero emite pitidos repetidos y no da video, ¿qué componente probablemente falla?", opciones: ["Teclado", "Gabinete", "Memoria RAM", "Unidad Óptica"], correcta: 2, image: "" },
    { id: 103, pregunta: "¿Qué tipo de mantenimiento se realiza antes de que ocurra una falla mediante limpiezas y mediciones?", opciones: ["Mantenimiento Correctivo", "Mantenimiento Predictivo", "Mantenimiento Preventivo", "Mantenimiento Reactivo"], correcta: 2, image: "" },
    { id: 104, pregunta: "¿Cuál de los siguientes es un sistema de archivos nativo de Windows 10/11?", opciones: ["EXT4", "NTFS", "FAT16", "APFS"], correcta: 1, image: "" },
    { id: 105, pregunta: "Al aplicar pasta térmica en el procesador, el objetivo principal es:", opciones: ["Pegar el disipador permanentemente", "Mejorar la transferencia de calor hacia el disipador", "Aumentar el voltaje del núcleo", "Evitar el polvo en los pines"], correcta: 1, image: "" }
];

// Generador para autocompletar dinámicamente hasta 30 preguntas de soporte técnico
for (let i = 6; i <= 30; i++) {
    bancoPredeterminado30.push({
        id: 100 + i,
        pregunta: `Pregunta Técnica de Control de Calidad N°${i} - Diagnóstico Infraestructura TIC Básica SENA.`,
        opciones: ["Opción de descarte A", "Opción de descarte B", "Respuesta Técnica Correcta Estándar", "Opción de descarte D"],
        correcta: 2,
        image: ""
    });
}