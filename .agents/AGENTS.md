# Reglas Persistentes del Proyecto Agente Comercial Solar

## REGLA INAMOVIBLE 1: APO (Auditoría Profunda Obligatoria)
Quedan estrictamente prohibidos los "hotfixes" ciegos o rápidos. Antes de realizar CUALQUIER modificación a una lógica existente, el agente DEBE obligatoriamente:
1. **Trazar el ciclo de vida completo:** Investigar quién llama a la función, qué parámetros recibe y si existen interceptores ocultos o código legacy que pueda interferir.
2. **Auditar el impacto (Zero Regressions):** Garantizar que el ajuste en un componente no provoque la caída o regresión de otro flujo que ya estaba operativo y validado.
3. **Planning Mode:** Presentar un Plan de Implementación formal detallando el diagnóstico técnico y solicitar la aprobación expresa del usuario antes de escribir o modificar una sola línea de código.

## REGLA INAMOVIBLE 2: HRU (Cero Hardcoding, Cero Regresiones, Universalidad Total)
Todo desarrollo, ajuste o refactorización debe regirse por el estándar HRU:
- **Cero Hardcoding:** No se permite codificar valores fijos, rutas estáticas o textos quemados en el código. Toda lógica debe ser dinámica y responder a los datos.
- **Cero Regresiones:** El sistema debe avanzar. Cualquier ajuste debe someterse a pruebas de no-regresión. No es aceptable sacrificar una funcionalidad operativa para habilitar otra.
- **Universalidad Total:** Las funcionalidades (ej. interceptores, visores de contenido) deben ser agnósticas y operar exactamente bajo las mismas reglas y experiencia de usuario, independientemente del tipo de recurso (ej. Documentos Detectados vs. Formatos/Anexos). La arquitectura debe ser escalable y unificada.

## REGLA INAMOVIBLE 3: Arquitectura Anti-God-Object y Microservicios
Queda estrictamente prohibido generar archivos masivos o acumular lógica de negocio en un solo componente o clase (ej. archivos de >1,000 líneas). 
- **Delegación Obligatoria:** Todo nuevo flujo, estado, orquestador o motor lógico DEBE construirse en un archivo independiente (microservicio, servicio de dominio u orquestador) y ser importado o inyectado en el ruteador principal.
- **Responsabilidad Única (SOLID):** Los archivos de enrutamiento (como `server.ts`) solo deben decidir "a quién llamar", nunca resolver el problema matemáticamente ni procesar cadenas largas directamente en su cuerpo.
- **Cero Tolerancia a Archivos Monstruo:** Si el Agente detecta que un archivo está creciendo de manera inmanejable o viola esta regla, debe alertar inmediatamente al usuario en un diagnóstico APO y solicitar permiso para delegar la nueva funcionalidad en un servicio modular antes de seguir inyectando código.

## REGLA INAMOVIBLE 4: U-First (Usabilidad y Experiencia Fantástica)
Todo desarrollo o refactorización debe tener como máxima prioridad la experiencia del usuario final (UX).
- **Empatía Técnica:** Está estrictamente prohibido diseñar flujos que requieran que el usuario final teclee comandos técnicos, IDs internos, o entienda la arquitectura del sistema. Toda interacción debe ser guiada a través de lenguaje natural o botones (UI).
- **Cero Callejones sin Salida (Frictionless):** Si el usuario comete un error, cambia de opinión, o se encuentra en un estado final de un proceso (ej. un resumen de cotización), el sistema DEBE proveer siempre una salida interactiva inmediata (ej. un botón de "Recalcular" o "Volver") sin requerir que el usuario adivine cómo retroceder.
- **Efecto WOW:** Las interfaces y los flujos deben sentirse vivos, profesionales y premium. El asistente no es solo un script que procesa datos; es una herramienta financiera y estratégica que debe guiar al usuario con claridad, confianza y cero fricción técnica.
