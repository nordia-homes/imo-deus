# Jarvis: ghemotoc albastru

Mascota este o sferă pufoasă albastră, fără brațe, picioare, antenă sau creastă. Corpul transparent din blue-body.png este generat cu skill-ul imagegen (tool built-in), nu un overlay dreptunghiular. Prompt final: «One round fluffy ball, saturated royal cobalt blue #3576E8 matching the supplied blue dot reference, blue fur and shading only; transparent background; no face, arms, legs, antenna, crest, hat, platform or text». Ochii și gura păstrează texturile existente din rig-atlas-v2.png.

Rigul are 10 straturi: corp, doi ochi, două irisuri, două pupile, două pleoape și gură. Privirea urmărește cursorul; blink la 1,7–4,5 secunde, plutire, înclinare, salt la succes și mișcare de confirmare. Gura și deformarea corpului reacționează la RMS audio, cu deformare limitată la 2,5%. Reduced motion dezactivează animațiile.

Scena office-scene.png rămâne vizibilă sub mascotă. Containerul interior folosește div cu fundal explicit transparent, pentru a evita regula globală agentfinder aplicată elementelor main. Testul UI rulează cu data-app-theme=agentfinder și verifică transparența și absența membrelor.

Cardurile vocale folosesc varianta compact a componentei existente AssistantResultCard: fără contor supradimensionat, imagini orizontale, preț albastru, vizionări compacte și aceiași handlers de paginare, prospectare, acord WhatsApp și planuri. Contextul conține date autorizate, fără contacte/proprietăți fictive.
