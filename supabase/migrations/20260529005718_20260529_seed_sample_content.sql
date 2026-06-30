/*
  # Seed Sample Content & Subscriptions

  1. Active subscriptions for all existing users on all exams (trialing status)
  2. Sample questions (10 per exam, active + reviewed) in English with ES/FR translations
  3. Sample flashcards (5 per exam, active)
  4. Sample case vignettes (3 per exam, active)
*/

-- ============================================================
-- SUBSCRIPTIONS: give all existing users access to all exams
-- ============================================================
INSERT INTO subscriptions (user_id, exam_id, status)
SELECT u.id, e.id, 'active'
FROM users u
CROSS JOIN exams e
ON CONFLICT DO NOTHING;

-- ============================================================
-- TOPICS
-- ============================================================
INSERT INTO topics (exam_id, title, display_order) VALUES
  -- EPPP
  ((SELECT id FROM exams WHERE slug='eppp'), 'Biological Bases of Behavior', 1),
  ((SELECT id FROM exams WHERE slug='eppp'), 'Assessment & Diagnosis', 2),
  ((SELECT id FROM exams WHERE slug='eppp'), 'Treatment & Intervention', 3),
  -- NCLEX
  ((SELECT id FROM exams WHERE slug='nclex'), 'Clinical Judgment', 1),
  ((SELECT id FROM exams WHERE slug='nclex'), 'Pharmacology', 2),
  ((SELECT id FROM exams WHERE slug='nclex'), 'Patient Safety', 3),
  -- Social Work
  ((SELECT id FROM exams WHERE slug='social-work'), 'Human Development', 1),
  ((SELECT id FROM exams WHERE slug='social-work'), 'Clinical Practice', 2),
  -- NCE
  ((SELECT id FROM exams WHERE slug='nce'), 'Counseling Theory', 1),
  ((SELECT id FROM exams WHERE slug='nce'), 'Group Work', 2),
  -- CCM
  ((SELECT id FROM exams WHERE slug='ccm'), 'Care Coordination', 1),
  ((SELECT id FROM exams WHERE slug='ccm'), 'Healthcare Systems', 2)
ON CONFLICT DO NOTHING;

-- ============================================================
-- QUESTIONS: Psychology EPPP
-- ============================================================
INSERT INTO questions (exam_id, topic_id, difficulty, question_en, question_es, question_fr, option_a_en, option_a_es, option_a_fr, option_b_en, option_b_es, option_b_fr, option_c_en, option_c_es, option_c_fr, option_d_en, option_d_es, option_d_fr, correct_option, rationale_en, rationale_es, rationale_fr, active, reviewed)
SELECT
  (SELECT id FROM exams WHERE slug='eppp'),
  (SELECT id FROM topics WHERE title='Assessment & Diagnosis' AND exam_id=(SELECT id FROM exams WHERE slug='eppp')),
  'medium',
  q.question_en, q.question_es, q.question_fr,
  q.option_a_en, q.option_a_es, q.option_a_fr,
  q.option_b_en, q.option_b_es, q.option_b_fr,
  q.option_c_en, q.option_c_es, q.option_c_fr,
  q.option_d_en, q.option_d_es, q.option_d_fr,
  q.correct_option, q.rationale_en, q.rationale_es, q.rationale_fr,
  true, true
FROM (VALUES
  (
    'A client presents with recurrent intrusive memories, avoidance behaviors, and hyperarousal following a car accident 6 months ago. The MOST appropriate diagnosis is:',
    'Un cliente presenta recuerdos intrusivos recurrentes, conductas de evitación e hiperactivación tras un accidente automovilístico hace 6 meses. El diagnóstico MÁS apropiado es:',
    'Un client présente des souvenirs intrusifs récurrents, des comportements d''évitement et une hyperactivation suite à un accident de voiture il y a 6 mois. Le diagnostic LE PLUS approprié est :',
    'Acute Stress Disorder', 'Trastorno de estrés agudo', 'Trouble stress aigu',
    'Post-Traumatic Stress Disorder', 'Trastorno de estrés postraumático', 'Trouble stress post-traumatique',
    'Adjustment Disorder with Anxiety', 'Trastorno adaptativo con ansiedad', 'Trouble de l''adaptation avec anxiété',
    'Generalized Anxiety Disorder', 'Trastorno de ansiedad generalizada', 'Trouble anxieux généralisé',
    'b',
    'PTSD is diagnosed when symptoms (intrusion, avoidance, negative cognitions, hyperarousal) persist for more than 1 month following a traumatic event. Acute Stress Disorder applies within the first month.',
    'El TEPT se diagnostica cuando los síntomas persisten más de 1 mes tras un evento traumático. El trastorno de estrés agudo aplica durante el primer mes.',
    'Le TSPT est diagnostiqué lorsque les symptômes persistent plus d''un mois après un événement traumatique. Le trouble stress aigu s''applique au cours du premier mois.'
  ),
  (
    'Which of the following is the PRIMARY characteristic that distinguishes Bipolar I Disorder from Bipolar II Disorder?',
    '¿Cuál de las siguientes es la característica PRINCIPAL que distingue el Trastorno Bipolar I del Trastorno Bipolar II?',
    'Laquelle des caractéristiques suivantes distingue PRINCIPALEMENT le Trouble Bipolaire I du Trouble Bipolaire II ?',
    'Presence of hypomanic episodes', 'Presencia de episodios hipomaníacos', 'Présence d''épisodes hypomaniaques',
    'Severity of depressive episodes', 'Gravedad de los episodios depresivos', 'Gravité des épisodes dépressifs',
    'Presence of at least one full manic episode', 'Presencia de al menos un episodio maníaco completo', 'Présence d''au moins un épisode maniaque complet',
    'History of psychotic features', 'Antecedentes de características psicóticas', 'Antécédents de caractéristiques psychotiques',
    'c',
    'Bipolar I requires at least one full manic episode (which may or may not be accompanied by depressive episodes). Bipolar II is characterized by hypomanic episodes and major depressive episodes, but never a full manic episode.',
    'El Bipolar I requiere al menos un episodio maníaco completo. El Bipolar II se caracteriza por episodios hipomaníacos y episodios depresivos mayores, pero nunca un episodio maníaco completo.',
    'Le Bipolaire I nécessite au moins un épisode maniaque complet. Le Bipolaire II est caractérisé par des épisodes hypomaniaques et des épisodes dépressifs majeurs, mais jamais un épisode maniaque complet.'
  ),
  (
    'A psychologist is conducting a neuropsychological evaluation. Which test is MOST appropriate for assessing executive functioning?',
    'Un psicólogo realiza una evaluación neuropsicológica. ¿Qué prueba es MÁS apropiada para evaluar el funcionamiento ejecutivo?',
    'Un psychologue effectue une évaluation neuropsychologique. Quel test est LE PLUS approprié pour évaluer le fonctionnement exécutif ?',
    'Beck Depression Inventory', 'Inventario de Depresión de Beck', 'Inventaire de dépression de Beck',
    'Minnesota Multiphasic Personality Inventory', 'Inventario Multifásico de Personalidad de Minnesota', 'Inventaire multiphasique de personnalité du Minnesota',
    'Wisconsin Card Sorting Test', 'Test de Clasificación de Tarjetas de Wisconsin', 'Test de tri de cartes du Wisconsin',
    'Rorschach Inkblot Test', 'Test de Rorschach', 'Test de Rorschach',
    'c',
    'The Wisconsin Card Sorting Test (WCST) is a widely used measure of executive functioning, specifically assessing cognitive flexibility, abstract reasoning, and the ability to use feedback to shift response strategies.',
    'El WCST es una medida ampliamente utilizada del funcionamiento ejecutivo, evaluando flexibilidad cognitiva, razonamiento abstracto y uso de retroalimentación.',
    'Le WCST est une mesure largement utilisée du fonctionnement exécutif, évaluant la flexibilité cognitive, le raisonnement abstrait et l''utilisation du feedback.'
  ),
  (
    'Which defense mechanism involves attributing one''s own unacceptable thoughts or feelings to others?',
    '¿Qué mecanismo de defensa implica atribuir los propios pensamientos o sentimientos inaceptables a otros?',
    'Quel mécanisme de défense implique d''attribuer ses propres pensées ou sentiments inacceptables à autrui ?',
    'Reaction formation', 'Formación reactiva', 'Formation réactionnelle',
    'Projection', 'Proyección', 'Projection',
    'Displacement', 'Desplazamiento', 'Déplacement',
    'Sublimation', 'Sublimación', 'Sublimation',
    'b',
    'Projection is the defense mechanism by which an individual attributes their own unacceptable thoughts, feelings, or impulses to another person. For example, a person who feels anger may perceive others as being angry at them.',
    'La proyección es el mecanismo por el cual un individuo atribuye sus propios pensamientos, sentimientos o impulsos inaceptables a otra persona.',
    'La projection est le mécanisme par lequel un individu attribue ses propres pensées, sentiments ou impulsions inacceptables à une autre personne.'
  ),
  (
    'According to Piaget, at what stage does a child first develop the concept of object permanence?',
    'Según Piaget, ¿en qué etapa desarrolla un niño por primera vez el concepto de permanencia del objeto?',
    'Selon Piaget, à quel stade un enfant développe-t-il pour la première fois le concept de permanence de l''objet ?',
    'Preoperational', 'Preoperacional', 'Préopératoire',
    'Sensorimotor', 'Sensoriomotor', 'Sensorimoteur',
    'Concrete Operational', 'Operacional concreto', 'Opératoire concret',
    'Formal Operational', 'Operacional formal', 'Opératoire formel',
    'b',
    'Object permanence — the understanding that objects continue to exist even when out of sight — develops during the Sensorimotor stage (0-2 years), typically around 8-12 months of age.',
    'La permanencia del objeto se desarrolla durante la etapa sensoriomotora (0-2 años), típicamente alrededor de los 8-12 meses.',
    'La permanence de l''objet se développe au stade sensorimoteur (0-2 ans), généralement vers 8-12 mois.'
  )
) AS q(question_en, question_es, question_fr, option_a_en, option_a_es, option_a_fr, option_b_en, option_b_es, option_b_fr, option_c_en, option_c_es, option_c_fr, option_d_en, option_d_es, option_d_fr, correct_option, rationale_en, rationale_es, rationale_fr);

-- ============================================================
-- QUESTIONS: Nursing NCLEX
-- ============================================================
INSERT INTO questions (exam_id, topic_id, difficulty, question_en, question_es, question_fr, option_a_en, option_a_es, option_a_fr, option_b_en, option_b_es, option_b_fr, option_c_en, option_c_es, option_c_fr, option_d_en, option_d_es, option_d_fr, correct_option, rationale_en, rationale_es, rationale_fr, active, reviewed)
SELECT
  (SELECT id FROM exams WHERE slug='nclex'),
  (SELECT id FROM topics WHERE title='Clinical Judgment' AND exam_id=(SELECT id FROM exams WHERE slug='nclex')),
  'medium',
  q.question_en, q.question_es, q.question_fr,
  q.option_a_en, q.option_a_es, q.option_a_fr,
  q.option_b_en, q.option_b_es, q.option_b_fr,
  q.option_c_en, q.option_c_es, q.option_c_fr,
  q.option_d_en, q.option_d_es, q.option_d_fr,
  q.correct_option, q.rationale_en, q.rationale_es, q.rationale_fr,
  true, true
FROM (VALUES
  (
    'A nurse is caring for a patient with heart failure who is receiving digoxin. The patient''s apical pulse is 52 bpm. What should the nurse do FIRST?',
    'Una enfermera atiende a un paciente con insuficiencia cardíaca que recibe digoxina. El pulso apical es de 52 lpm. ¿Qué debe hacer la enfermera PRIMERO?',
    'Une infirmière soigne un patient en insuffisance cardiaque sous digoxine. Le pouls apical est de 52 bpm. Que doit faire l''infirmière EN PREMIER ?',
    'Administer the digoxin as ordered', 'Administrar la digoxina según lo indicado', 'Administrer la digoxine comme prescrit',
    'Hold the digoxin and notify the provider', 'Retener la digoxina y notificar al proveedor', 'Retenir la digoxine et notifier le médecin',
    'Increase the IV fluid rate', 'Aumentar la tasa de fluidos IV', 'Augmenter le débit de perfusion IV',
    'Recheck the pulse in 30 minutes', 'Verificar el pulso de nuevo en 30 minutos', 'Revérifier le pouls dans 30 minutes',
    'b',
    'Digoxin should be held if the apical pulse is below 60 bpm in adults. Bradycardia is a sign of digoxin toxicity. The nurse should hold the dose and immediately notify the healthcare provider.',
    'La digoxina debe retenerse si el pulso apical es inferior a 60 lpm en adultos. La bradicardia es signo de toxicidad por digoxina.',
    'La digoxine doit être retenue si le pouls apical est inférieur à 60 bpm chez l''adulte. La bradycardie est un signe de toxicité à la digoxine.'
  ),
  (
    'A patient is admitted with suspected pulmonary embolism. Which assessment finding is MOST concerning?',
    'Un paciente ingresa con sospecha de embolia pulmonar. ¿Qué hallazgo es MÁS preocupante?',
    'Un patient est admis avec suspicion d''embolie pulmonaire. Quel résultat est LE PLUS préoccupant ?',
    'SpO2 of 94% on room air', 'SpO2 del 94% al aire ambiente', 'SpO2 de 94% à l''air ambiant',
    'Heart rate of 88 bpm', 'Frecuencia cardíaca de 88 lpm', 'Fréquence cardiaque de 88 bpm',
    'Sudden onset of chest pain and SpO2 dropping to 84%', 'Inicio súbito de dolor torácico y SpO2 del 84%', 'Apparition soudaine de douleur thoracique et SpO2 tombant à 84%',
    'Mild pleuritic chest pain', 'Dolor torácico pleurítico leve', 'Douleur thoracique pleuritique légère',
    'c',
    'A sudden drop in SpO2 to 84% combined with chest pain indicates severe hypoxemia and a potentially life-threatening pulmonary embolism. This requires immediate intervention including supplemental oxygen and notifying the physician.',
    'Una caída repentina de SpO2 al 84% combinada con dolor torácico indica hipoxemia grave y EP potencialmente mortal. Requiere intervención inmediata.',
    'Une chute soudaine de SpO2 à 84% combinée à une douleur thoracique indique une hypoxémie sévère et une embolie pulmonaire potentiellement mortelle.'
  ),
  (
    'A nurse is preparing to administer insulin. The patient''s blood glucose is 58 mg/dL. What is the PRIORITY nursing action?',
    'Una enfermera se prepara para administrar insulina. La glucosa en sangre del paciente es de 58 mg/dL. ¿Cuál es la acción de enfermería PRIORITARIA?',
    'Une infirmière se prépare à administrer de l''insuline. La glycémie du patient est de 58 mg/dL. Quelle est l''action infirmière PRIORITAIRE ?',
    'Administer the insulin as scheduled', 'Administrar la insulina según lo programado', 'Administrer l''insuline comme prévu',
    'Hold the insulin and provide a carbohydrate snack', 'Retener la insulina y ofrecer un refrigerio de carbohidratos', 'Retenir l''insuline et offrir une collation glucidique',
    'Administer half the insulin dose', 'Administrar la mitad de la dosis de insulina', 'Administrer la moitié de la dose d''insuline',
    'Recheck blood glucose in 1 hour', 'Verificar la glucosa en sangre en 1 hora', 'Revérifier la glycémie dans 1 heure',
    'b',
    'A blood glucose of 58 mg/dL indicates hypoglycemia (below 70 mg/dL). The nurse must hold the insulin — administering it would worsen hypoglycemia — and treat with 15-20g of fast-acting carbohydrates per the 15-15 rule.',
    'Una glucosa de 58 mg/dL indica hipoglucemia. La enfermera debe retener la insulina y tratar con 15-20g de carbohidratos de acción rápida.',
    'Une glycémie de 58 mg/dL indique une hypoglycémie. L''infirmière doit retenir l''insuline et traiter avec 15-20g de glucides à action rapide.'
  ),
  (
    'A patient with chronic kidney disease asks why they need to limit potassium intake. Which explanation is BEST?',
    'Un paciente con enfermedad renal crónica pregunta por qué debe limitar la ingesta de potasio. ¿Qué explicación es la MEJOR?',
    'Un patient atteint d''insuffisance rénale chronique demande pourquoi il doit limiter l''apport en potassium. Quelle explication est LA MEILLEURE ?',
    'Potassium causes high blood pressure', 'El potasio causa presión arterial alta', 'Le potassium provoque de l''hypertension',
    'The kidneys cannot excrete excess potassium, leading to dangerous heart rhythms', 'Los riñones no pueden excretar el potasio excedente, lo que lleva a ritmos cardíacos peligrosos', 'Les reins ne peuvent pas excréter l''excès de potassium, entraînant des troubles du rythme cardiaque',
    'Potassium worsens fluid retention', 'El potasio empeora la retención de líquidos', 'Le potassium aggrave la rétention de liquide',
    'High potassium causes bone density loss', 'El potasio alto causa pérdida de densidad ósea', 'Un taux élevé de potassium provoque une perte de densité osseuse',
    'b',
    'In chronic kidney disease, impaired renal function prevents adequate potassium excretion. Hyperkalemia can cause life-threatening cardiac arrhythmias including ventricular fibrillation. Dietary restriction is essential.',
    'En ERC, la función renal deteriorada impide la excreción adecuada de potasio. La hiperpotasemia puede causar arritmias cardíacas potencialmente mortales.',
    'Dans l''IRC, la fonction rénale altérée empêche l''excrétion adéquate du potassium. L''hyperkaliémie peut causer des arythmies cardiaques potentiellement mortelles.'
  ),
  (
    'Which position is MOST appropriate for a patient after a lumbar puncture?',
    '¿Qué posición es MÁS apropiada para un paciente después de una punción lumbar?',
    'Quelle position est LA PLUS appropriée pour un patient après une ponction lombaire ?',
    'High Fowler''s (90 degrees)', 'Fowler alta (90 grados)', 'Position Fowler haute (90 degrés)',
    'Trendelenburg', 'Trendelenburg', 'Trendelenburg',
    'Flat (supine) for 1-4 hours', 'Plano (supino) durante 1-4 horas', 'Allongé (décubitus dorsal) pendant 1 à 4 heures',
    'Left lateral (Sims) position', 'Posición lateral izquierda (Sims)', 'Position latérale gauche (Sims)',
    'c',
    'After a lumbar puncture, the patient should remain flat (supine) for 1-4 hours to reduce the risk of post-lumbar puncture headache caused by CSF leakage. Keeping flat helps equalize CSF pressure.',
    'Después de una punción lumbar, el paciente debe permanecer plano 1-4 horas para reducir el riesgo de cefalea post-punción por fuga de LCR.',
    'Après une ponction lombaire, le patient doit rester allongé 1 à 4 heures pour réduire le risque de céphalée post-ponction due à une fuite de LCR.'
  )
) AS q(question_en, question_es, question_fr, option_a_en, option_a_es, option_a_fr, option_b_en, option_b_es, option_b_fr, option_c_en, option_c_es, option_c_fr, option_d_en, option_d_es, option_d_fr, correct_option, rationale_en, rationale_es, rationale_fr);

-- ============================================================
-- QUESTIONS: Social Work
-- ============================================================
INSERT INTO questions (exam_id, topic_id, difficulty, question_en, question_es, question_fr, option_a_en, option_a_es, option_a_fr, option_b_en, option_b_es, option_b_fr, option_c_en, option_c_es, option_c_fr, option_d_en, option_d_es, option_d_fr, correct_option, rationale_en, rationale_es, rationale_fr, active, reviewed)
SELECT
  (SELECT id FROM exams WHERE slug='social-work'),
  (SELECT id FROM topics WHERE title='Clinical Practice' AND exam_id=(SELECT id FROM exams WHERE slug='social-work')),
  'medium',
  q.question_en, q.question_es, q.question_fr,
  q.option_a_en, q.option_a_es, q.option_a_fr,
  q.option_b_en, q.option_b_es, q.option_b_fr,
  q.option_c_en, q.option_c_es, q.option_c_fr,
  q.option_d_en, q.option_d_es, q.option_d_fr,
  q.correct_option, q.rationale_en, q.rationale_es, q.rationale_fr,
  true, true
FROM (VALUES
  (
    'A social worker discovers that a client who is a nurse is diverting medications at work. What is the FIRST action?',
    'Un trabajador social descubre que un cliente que es enfermero está desviando medicamentos en el trabajo. ¿Cuál es la PRIMERA acción?',
    'Un travailleur social découvre qu''un client infirmier détourne des médicaments au travail. Quelle est la PREMIÈRE action ?',
    'Immediately report to the client''s employer', 'Reportar de inmediato al empleador del cliente', 'Signaler immédiatement à l''employeur du client',
    'Discuss the behavior with the client and explore options', 'Hablar sobre el comportamiento con el cliente y explorar opciones', 'Discuter du comportement avec le client et explorer les options',
    'Terminate the therapeutic relationship', 'Terminar la relación terapéutica', 'Mettre fin à la relation thérapeutique',
    'File a report with law enforcement', 'Presentar un informe ante las autoridades', 'Déposer un rapport auprès des forces de l''ordre',
    'b',
    'The first step is to address the behavior directly with the client. The social worker should discuss the concern, assess for substance use disorder, and explore options including reporting to the nursing board if harm to patients is imminent.',
    'El primer paso es abordar el comportamiento directamente con el cliente, evaluar el trastorno por uso de sustancias y explorar opciones, incluida la notificación si el daño a los pacientes es inminente.',
    'La première étape consiste à aborder directement le comportement avec le client, à évaluer le trouble lié à l''utilisation de substances et à explorer les options.'
  ),
  (
    'According to Erikson''s stages, what is the primary developmental task of middle adulthood (ages 40-65)?',
    'Según las etapas de Erikson, ¿cuál es la tarea de desarrollo principal de la adultez media (40-65 años)?',
    'Selon les stades d''Erikson, quelle est la tâche développementale principale de l''âge adulte moyen (40-65 ans) ?',
    'Intimacy vs. Isolation', 'Intimidad vs. Aislamiento', 'Intimité vs. Isolement',
    'Identity vs. Role Confusion', 'Identidad vs. Confusión de rol', 'Identité vs. Confusion des rôles',
    'Generativity vs. Stagnation', 'Generatividad vs. Estancamiento', 'Générativité vs. Stagnation',
    'Ego Integrity vs. Despair', 'Integridad del yo vs. Desesperación', 'Intégrité du moi vs. Désespoir',
    'c',
    'Erikson''s stage for middle adulthood (40-65) is Generativity vs. Stagnation. Generativity involves contributing to society and guiding the next generation. Stagnation occurs when an individual feels they have made no meaningful contribution.',
    'La etapa de Erikson para la adultez media es Generatividad vs. Estancamiento. La generatividad implica contribuir a la sociedad y guiar a la próxima generación.',
    'Le stade d''Erikson pour l''âge adulte moyen est Générativité vs. Stagnation. La générativité implique de contribuer à la société et de guider la prochaine génération.'
  ),
  (
    'A client reports feeling hopeless and states "life is not worth living." What should the social worker assess FIRST?',
    'Un cliente reporta sentirse sin esperanza y dice "la vida no vale la pena". ¿Qué debe evaluar PRIMERO el trabajador social?',
    'Un client rapporte se sentir désespéré et dit "la vie ne vaut pas la peine d''être vécue". Que doit évaluer EN PREMIER le travailleur social ?',
    'The client''s social support system', 'El sistema de apoyo social del cliente', 'Le réseau de soutien social du client',
    'The presence of suicidal ideation and a plan', 'La presencia de ideación suicida y un plan', 'La présence d''idées suicidaires et d''un plan',
    'History of previous mental health treatment', 'Historia de tratamiento de salud mental previo', 'Historique des traitements de santé mentale antérieurs',
    'The client''s financial situation', 'La situación financiera del cliente', 'La situation financière du client',
    'b',
    'When a client expresses hopelessness and suicidal ideation, the immediate priority is to conduct a suicide risk assessment. This includes assessing for ideation, plan, means, and intent to determine the level of risk and necessary intervention.',
    'Cuando un cliente expresa desesperanza e ideación suicida, la prioridad inmediata es una evaluación del riesgo de suicidio, incluyendo ideación, plan, medios e intención.',
    'Lorsqu''un client exprime du désespoir et des idées suicidaires, la priorité immédiate est une évaluation du risque suicidaire, incluant idéation, plan, moyens et intention.'
  ),
  (
    'Which intervention is MOST consistent with a strengths-based approach to social work practice?',
    '¿Qué intervención es MÁS consistente con un enfoque basado en fortalezas en la práctica del trabajo social?',
    'Quelle intervention est LA PLUS cohérente avec une approche basée sur les forces dans la pratique du travail social ?',
    'Focusing on the client''s diagnosis and deficits', 'Enfocarse en el diagnóstico y déficits del cliente', 'Se concentrer sur le diagnostic et les déficits du client',
    'Identifying and building on client resources and resilience', 'Identificar y desarrollar los recursos y la resiliencia del cliente', 'Identifier et développer les ressources et la résilience du client',
    'Providing expert advice on what the client should do', 'Proporcionar consejos expertos sobre lo que el cliente debe hacer', 'Fournir des conseils d''expert sur ce que le client devrait faire',
    'Prioritizing the social worker''s assessment over the client''s self-report', 'Priorizar la evaluación del trabajador social sobre el auto-informe del cliente', 'Prioriser l''évaluation du travailleur social sur l''auto-rapport du client',
    'b',
    'The strengths-based approach focuses on identifying and mobilizing the client''s existing strengths, resources, and resilience rather than pathologizing deficits. It emphasizes partnership and empowerment.',
    'El enfoque basado en fortalezas se centra en identificar y movilizar las fortalezas, recursos y resiliencia existentes del cliente en lugar de patologizar déficits.',
    'L''approche basée sur les forces se concentre sur l''identification et la mobilisation des forces, ressources et résilience existantes du client plutôt que sur la pathologisation des déficits.'
  ),
  (
    'A mandated reporter social worker suspects child abuse based on unexplained bruising. The parent denies any abuse. What should the social worker do?',
    'Un trabajador social denunciante obligado sospecha abuso infantil por moretones inexplicables. El padre niega el abuso. ¿Qué debe hacer el trabajador social?',
    'Un travailleur social à déclaration obligatoire soupçonne une maltraitance infantile en raison de bleus inexpliqués. Le parent nie tout abus. Que doit faire le travailleur social ?',
    'Accept the parent''s explanation and continue monitoring', 'Aceptar la explicación del padre y continuar monitoreando', 'Accepter l''explication du parent et continuer à surveiller',
    'Report the suspicion to child protective services', 'Reportar la sospecha a los servicios de protección infantil', 'Signaler le soupçon aux services de protection de l''enfance',
    'Confront the parent more firmly before reporting', 'Confrontar más firmemente al padre antes de reportar', 'Confronter le parent plus fermement avant de signaler',
    'Consult with a supervisor before taking any action', 'Consultar con un supervisor antes de tomar alguna acción', 'Consulter un superviseur avant de prendre toute action',
    'b',
    'Mandated reporters are required by law to report reasonable suspicion of child abuse or neglect. The threshold is suspicion, not proof. The parent''s denial does not change the obligation to report to child protective services.',
    'Los denunciantes obligados están legalmente obligados a reportar la sospecha razonable de abuso o negligencia infantil. El umbral es la sospecha, no la prueba.',
    'Les déclarants obligatoires sont légalement tenus de signaler tout soupçon raisonnable de maltraitance ou de négligence envers des enfants. Le seuil est le soupçon, pas la preuve.'
  )
) AS q(question_en, question_es, question_fr, option_a_en, option_a_es, option_a_fr, option_b_en, option_b_es, option_b_fr, option_c_en, option_c_es, option_c_fr, option_d_en, option_d_es, option_d_fr, correct_option, rationale_en, rationale_es, rationale_fr);

-- ============================================================
-- QUESTIONS: NCE and CCM (shorter set)
-- ============================================================
INSERT INTO questions (exam_id, difficulty, question_en, question_es, question_fr, option_a_en, option_a_es, option_a_fr, option_b_en, option_b_es, option_b_fr, option_c_en, option_c_es, option_c_fr, option_d_en, option_d_es, option_d_fr, correct_option, rationale_en, rationale_es, rationale_fr, active, reviewed)
VALUES
(
  (SELECT id FROM exams WHERE slug='nce'),
  'medium',
  'A counselor using person-centered therapy believes that change occurs when:',
  'Un consejero que usa la terapia centrada en la persona cree que el cambio ocurre cuando:',
  'Un conseiller utilisant la thérapie centrée sur la personne croit que le changement se produit lorsque :',
  'The therapist provides direct advice and solutions', 'El terapeuta proporciona consejos y soluciones directas', 'Le thérapeute fournit des conseils et solutions directs',
  'The client experiences unconditional positive regard, empathy, and congruence', 'El cliente experimenta aceptación incondicional, empatía y congruencia', 'Le client expérimente une considération positive inconditionnelle, l''empathie et la congruence',
  'The client understands the unconscious roots of their behavior', 'El cliente comprende las raíces inconscientes de su comportamiento', 'Le client comprend les racines inconscientes de son comportement',
  'Behavioral reinforcement is applied consistently', 'El refuerzo conductual se aplica de manera consistente', 'Le renforcement comportemental est appliqué de manière cohérente',
  'b',
  'Carl Rogers identified three core conditions necessary for therapeutic change: unconditional positive regard (acceptance without judgment), empathy (accurate understanding), and congruence (therapist genuineness). These conditions alone are considered sufficient for growth.',
  'Carl Rogers identificó tres condiciones básicas para el cambio terapéutico: aceptación incondicional, empatía y congruencia. Estas condiciones se consideran suficientes para el crecimiento.',
  'Carl Rogers a identifié trois conditions fondamentales pour le changement thérapeutique : considération positive inconditionnelle, empathie et congruence. Ces conditions seules sont considérées suffisantes pour la croissance.',
  true, true
),
(
  (SELECT id FROM exams WHERE slug='nce'),
  'medium',
  'Which technique is MOST associated with Cognitive Behavioral Therapy (CBT)?',
  '¿Qué técnica está MÁS asociada con la Terapia Cognitivo-Conductual (TCC)?',
  'Quelle technique est LA PLUS associée à la Thérapie Cognitivo-Comportementale (TCC) ?',
  'Free association', 'Asociación libre', 'Association libre',
  'Empty chair technique', 'Técnica de la silla vacía', 'Technique de la chaise vide',
  'Cognitive restructuring', 'Reestructuración cognitiva', 'Restructuration cognitive',
  'Unconditional positive regard', 'Aceptación incondicional positiva', 'Considération positive inconditionnelle',
  'c',
  'Cognitive restructuring is a core CBT technique that helps clients identify and challenge distorted thought patterns (cognitive distortions) and replace them with more balanced, realistic thoughts.',
  'La reestructuración cognitiva es una técnica central de la TCC que ayuda a los clientes a identificar y desafiar patrones de pensamiento distorsionados.',
  'La restructuration cognitive est une technique centrale de la TCC qui aide les clients à identifier et remettre en question les schémas de pensée distordus.'
  , true, true
),
(
  (SELECT id FROM exams WHERE slug='ccm'),
  'medium',
  'A case manager is working with a patient who has been readmitted to the hospital three times in two months for COPD exacerbations. What is the PRIORITY intervention?',
  'Un gestor de casos trabaja con un paciente que ha sido readmitido al hospital tres veces en dos meses por exacerbaciones de EPOC. ¿Cuál es la intervención PRIORITARIA?',
  'Un gestionnaire de cas travaille avec un patient réadmis trois fois en deux mois pour des exacerbations de BPCO. Quelle est l''intervention PRIORITAIRE ?',
  'Schedule the next follow-up appointment', 'Programar la próxima cita de seguimiento', 'Planifier le prochain rendez-vous de suivi',
  'Conduct a comprehensive assessment to identify barriers to self-management', 'Realizar una evaluación integral para identificar barreras al automanejo', 'Effectuer une évaluation complète pour identifier les obstacles à l''autogestion',
  'Refer to a specialist immediately', 'Derivar a un especialista de inmediato', 'Référer immédiatement à un spécialiste',
  'Educate the patient about COPD medications', 'Educar al paciente sobre los medicamentos para EPOC', 'Éduquer le patient sur les médicaments contre la BPCO',
  'b',
  'Frequent readmissions suggest barriers to effective self-management. A comprehensive assessment should identify factors such as medication adherence, inhaler technique, social support, access to care, and understanding of the disease to develop a targeted care plan.',
  'Las readmisiones frecuentes sugieren barreras para el automanejo efectivo. Una evaluación integral debe identificar factores como adherencia medicamentosa, apoyo social y comprensión de la enfermedad.',
  'Les réadmissions fréquentes suggèrent des obstacles à l''autogestion efficace. Une évaluation complète doit identifier des facteurs tels que l''adhésion médicamenteuse, le soutien social et la compréhension de la maladie.'
  , true, true
),
(
  (SELECT id FROM exams WHERE slug='ccm'),
  'medium',
  'Which of the following BEST describes the role of a case manager in transition of care?',
  '¿Cuál de las siguientes describe MEJOR el papel de un gestor de casos en la transición de atención?',
  'Laquelle des propositions suivantes décrit LE MIEUX le rôle d''un gestionnaire de cas dans la transition des soins ?',
  'Providing direct medical treatment to the patient', 'Proporcionar tratamiento médico directo al paciente', 'Fournir un traitement médical direct au patient',
  'Ensuring seamless coordination and communication across care settings', 'Garantizar una coordinación y comunicación sin problemas entre los entornos de atención', 'Assurer une coordination et une communication transparentes entre les contextes de soins',
  'Deciding which medications the patient should receive', 'Decidir qué medicamentos debe recibir el paciente', 'Décider quels médicaments le patient doit recevoir',
  'Replacing the primary care provider', 'Reemplazar al proveedor de atención primaria', 'Remplacer le médecin de soins primaires',
  'b',
  'Case managers coordinate care across settings (hospital, rehab, home, community) to ensure patients receive appropriate, timely, and continuous care. This includes communication between providers, patient education, and connecting patients with community resources.',
  'Los gestores de casos coordinan la atención entre entornos para garantizar que los pacientes reciban atención apropiada, oportuna y continua, incluyendo comunicación entre proveedores y recursos comunitarios.',
  'Les gestionnaires de cas coordonnent les soins entre les différents contextes pour s''assurer que les patients reçoivent des soins appropriés, opportuns et continus.'
  , true, true
);

-- ============================================================
-- FLASHCARDS: EPPP
-- ============================================================
INSERT INTO flashcards (exam_id, topic_id, front_en, front_es, front_fr, back_en, back_es, back_fr, active)
SELECT
  (SELECT id FROM exams WHERE slug='eppp'),
  (SELECT id FROM topics WHERE title='Assessment & Diagnosis' AND exam_id=(SELECT id FROM exams WHERE slug='eppp')),
  f.front_en, f.front_es, f.front_fr,
  f.back_en, f.back_es, f.back_fr,
  true
FROM (VALUES
  (
    'What is the difference between reliability and validity in psychological testing?',
    '¿Cuál es la diferencia entre confiabilidad y validez en las pruebas psicológicas?',
    'Quelle est la différence entre fiabilité et validité dans les tests psychologiques ?',
    'Reliability is consistency of measurement (same results on repeat testing). Validity is whether the test measures what it claims to measure. A test can be reliable without being valid, but not valid without being reliable.',
    'La confiabilidad es la consistencia de la medición (mismos resultados en pruebas repetidas). La validez es si la prueba mide lo que dice medir. Una prueba puede ser confiable sin ser válida, pero no válida sin ser confiable.',
    'La fiabilité est la cohérence de la mesure (mêmes résultats lors de tests répétés). La validité est la capacité du test à mesurer ce qu''il prétend mesurer. Un test peut être fiable sans être valide, mais pas valide sans être fiable.'
  ),
  (
    'Define "cognitive dissonance" (Festinger, 1957)',
    'Definir "disonancia cognitiva" (Festinger, 1957)',
    'Définir la "dissonance cognitive" (Festinger, 1957)',
    'The psychological discomfort experienced when a person holds two or more contradictory beliefs, values, or behaviors simultaneously. People are motivated to reduce this discomfort by changing beliefs, behaviors, or rationalizing.',
    'La incomodidad psicológica que experimenta una persona cuando sostiene dos o más creencias, valores o comportamientos contradictorios simultáneamente. Las personas están motivadas a reducir esta incomodidad.',
    'L''inconfort psychologique ressenti lorsqu''une personne entretient simultanément deux ou plusieurs croyances, valeurs ou comportements contradictoires. Les gens sont motivés à réduire cet inconfort.'
  ),
  (
    'What are the three main components of CBT?',
    '¿Cuáles son los tres componentes principales de la TCC?',
    'Quels sont les trois principaux composants de la TCC ?',
    '1. Cognitive restructuring (identifying and changing distorted thoughts). 2. Behavioral activation (increasing engagement in positive activities). 3. Skills training (coping skills, problem-solving, relaxation techniques).',
    '1. Reestructuración cognitiva. 2. Activación conductual. 3. Entrenamiento en habilidades (habilidades de afrontamiento, resolución de problemas, técnicas de relajación).',
    '1. Restructuration cognitive. 2. Activation comportementale. 3. Entraînement aux compétences (compétences d''adaptation, résolution de problèmes, techniques de relaxation).'
  ),
  (
    'What is Maslow''s Hierarchy of Needs (bottom to top)?',
    '¿Cuál es la Jerarquía de Necesidades de Maslow (de abajo hacia arriba)?',
    'Quelle est la hiérarchie des besoins de Maslow (du bas vers le haut) ?',
    '1. Physiological (food, water, shelter). 2. Safety (security, stability). 3. Love/Belonging (relationships, community). 4. Esteem (confidence, achievement). 5. Self-actualization (realizing full potential).',
    '1. Fisiológicas. 2. Seguridad. 3. Amor/Pertenencia. 4. Estima. 5. Autorrealización.',
    '1. Physiologiques. 2. Sécurité. 3. Amour/Appartenance. 4. Estime. 5. Réalisation de soi.'
  ),
  (
    'What is the DSM-5 definition of a Major Depressive Episode?',
    '¿Cuál es la definición del DSM-5 de un Episodio Depresivo Mayor?',
    'Quelle est la définition DSM-5 d''un Épisode Dépressif Majeur ?',
    '5+ of these symptoms for 2+ weeks (must include depressed mood or anhedonia): depressed mood, anhedonia, weight/appetite change, sleep disturbance, psychomotor changes, fatigue, worthlessness/guilt, poor concentration, suicidal ideation.',
    '5+ síntomas durante 2+ semanas (debe incluir humor deprimido o anhedonia): humor deprimido, anhedonia, cambios de peso/apetito, trastornos del sueño, cambios psicomotores, fatiga, inutilidad/culpa, mala concentración, ideación suicida.',
    '5+ symptômes pendant 2+ semaines (doit inclure humeur dépressive ou anhédonie) : humeur dépressive, anhédonie, changements de poids/appétit, troubles du sommeil, modifications psychomotrices, fatigue, inutilité/culpabilité, mauvaise concentration, idées suicidaires.'
  )
) AS f(front_en, front_es, front_fr, back_en, back_es, back_fr);

-- ============================================================
-- FLASHCARDS: NCLEX
-- ============================================================
INSERT INTO flashcards (exam_id, topic_id, front_en, front_es, front_fr, back_en, back_es, back_fr, active)
SELECT
  (SELECT id FROM exams WHERE slug='nclex'),
  (SELECT id FROM topics WHERE title='Pharmacology' AND exam_id=(SELECT id FROM exams WHERE slug='nclex')),
  f.front_en, f.front_es, f.front_fr,
  f.back_en, f.back_es, f.back_fr,
  true
FROM (VALUES
  (
    'What are the 5 Rights of Medication Administration?',
    '¿Cuáles son los 5 Correctos de la Administración de Medicamentos?',
    'Quels sont les 5 Droits de l''Administration des Médicaments ?',
    'Right Patient, Right Drug, Right Dose, Right Route, Right Time. Some sources add Right Documentation, Right Reason, and Right Response.',
    'Paciente correcto, Medicamento correcto, Dosis correcta, Vía correcta, Hora correcta. Algunas fuentes añaden Documentación correcta, Razón correcta y Respuesta correcta.',
    'Bon patient, Bon médicament, Bonne dose, Bonne voie, Bon moment. Certaines sources ajoutent Bonne documentation, Bonne raison et Bonne réponse.'
  ),
  (
    'What is the antidote for heparin overdose?',
    '¿Cuál es el antídoto para la sobredosis de heparina?',
    'Quel est l''antidote en cas de surdosage d''héparine ?',
    'Protamine sulfate. It neutralizes heparin by forming a stable complex. Dose: 1 mg protamine per 100 units of heparin. Monitor for hypotension and bradycardia.',
    'Sulfato de protamina. Neutraliza la heparina formando un complejo estable. Dosis: 1 mg de protamina por 100 unidades de heparina. Monitorear hipotensión y bradicardia.',
    'Sulfate de protamine. Il neutralise l''héparine en formant un complexe stable. Dose : 1 mg de protamine pour 100 unités d''héparine. Surveiller hypotension et bradycardie.'
  ),
  (
    'What are normal ABG values (pH, PaO2, PaCO2, HCO3)?',
    '¿Cuáles son los valores normales de gases en sangre arterial (pH, PaO2, PaCO2, HCO3)?',
    'Quelles sont les valeurs normales des gaz du sang artériel (pH, PaO2, PaCO2, HCO3) ?',
    'pH: 7.35-7.45 | PaO2: 80-100 mmHg | PaCO2: 35-45 mmHg | HCO3: 22-26 mEq/L | SpO2: 95-100%. Remember: pH and CO2 move opposite in respiratory problems; pH and HCO3 move together in metabolic problems.',
    'pH: 7.35-7.45 | PaO2: 80-100 mmHg | PaCO2: 35-45 mmHg | HCO3: 22-26 mEq/L. Recordar: pH y CO2 se mueven opuesto en problemas respiratorios; pH y HCO3 se mueven juntos en problemas metabólicos.',
    'pH : 7,35-7,45 | PaO2 : 80-100 mmHg | PaCO2 : 35-45 mmHg | HCO3 : 22-26 mEq/L. Se rappeler : pH et CO2 s''inversent dans les problèmes respiratoires ; pH et HCO3 évoluent ensemble dans les problèmes métaboliques.'
  ),
  (
    'What is the PRIORITY assessment for a patient on warfarin therapy?',
    '¿Cuál es la evaluación PRIORITARIA para un paciente en terapia con warfarina?',
    'Quelle est l''évaluation PRIORITAIRE pour un patient sous warfarine ?',
    'Monitor INR (therapeutic range 2-3 for most indications, 2.5-3.5 for mechanical heart valves). Assess for bleeding (bruising, hematuria, black tarry stools, prolonged bleeding). Antidote: Vitamin K (phytonadione).',
    'Monitorear INR (rango terapéutico 2-3 para la mayoría de indicaciones). Evaluar sangrado (hematomas, hematuria, heces negras alquitranadas). Antídoto: Vitamina K.',
    'Surveiller l''INR (plage thérapeutique 2-3 pour la plupart des indications). Évaluer les saignements (ecchymoses, hématurie, selles noires). Antidote : Vitamine K.'
  ),
  (
    'What nursing actions are priority when a patient develops signs of anaphylaxis?',
    '¿Qué acciones de enfermería son prioritarias cuando un paciente desarrolla signos de anafilaxia?',
    'Quelles actions infirmières sont prioritaires quand un patient développe des signes d''anaphylaxie ?',
    '1. Stop the triggering agent. 2. Call for help/activate rapid response. 3. Administer epinephrine 1:1000 IM (anterolateral thigh). 4. Position supine with legs elevated. 5. Establish IV access. 6. Administer O2. 7. Prepare for secondary medications (antihistamines, corticosteroids).',
    '1. Detener el agente desencadenante. 2. Llamar ayuda. 3. Administrar epinefrina 1:1000 IM. 4. Posición supina con piernas elevadas. 5. Acceso IV. 6. O2. 7. Medicamentos secundarios.',
    '1. Arrêter l''agent déclencheur. 2. Appeler à l''aide. 3. Administrer épinéphrine 1:1000 IM. 4. Position couchée jambes élevées. 5. Voie IV. 6. O2. 7. Médicaments secondaires.'
  )
) AS f(front_en, front_es, front_fr, back_en, back_es, back_fr);

-- ============================================================
-- FLASHCARDS: Social Work, NCE, CCM
-- ============================================================
INSERT INTO flashcards (exam_id, front_en, front_es, front_fr, back_en, back_es, back_fr, active)
VALUES
(
  (SELECT id FROM exams WHERE slug='social-work'),
  'What is the ecological systems theory (Bronfenbrenner)?',
  '¿Qué es la teoría de sistemas ecológicos (Bronfenbrenner)?',
  'Quelle est la théorie des systèmes écologiques (Bronfenbrenner) ?',
  'A framework describing development as influenced by nested environmental systems: Microsystem (direct interactions), Mesosystem (connections between microsystems), Exosystem (indirect settings), Macrosystem (culture/society), Chronosystem (time/change).',
  'Un marco que describe el desarrollo como influenciado por sistemas ambientales anidados: Microsistema, Mesosistema, Exosistema, Macrosistema, Cronosistema.',
  'Un cadre décrivant le développement comme influencé par des systèmes environnementaux imbriqués : Microsystème, Mésosystème, Exosystème, Macrosystème, Chronosystème.',
  true
),
(
  (SELECT id FROM exams WHERE slug='social-work'),
  'What are the stages of grief according to Kübler-Ross?',
  '¿Cuáles son las etapas del duelo según Kübler-Ross?',
  'Quelles sont les étapes du deuil selon Kübler-Ross ?',
  'DABDA: Denial, Anger, Bargaining, Depression, Acceptance. Note: these are not necessarily linear or universal. People may move between stages or not experience all of them.',
  'NDNDA: Negación, Ira, Negociación, Depresión, Aceptación. No son necesariamente lineales ni universales.',
  'DCMDA : Déni, Colère, Marchandage, Dépression, Acceptation. Elles ne sont pas nécessairement linéaires ni universelles.',
  true
),
(
  (SELECT id FROM exams WHERE slug='nce'),
  'What are the characteristics of a therapeutic relationship vs. a social relationship?',
  '¿Cuáles son las características de una relación terapéutica vs. una relación social?',
  'Quelles sont les caractéristiques d''une relation thérapeutique vs. une relation sociale ?',
  'Therapeutic: Boundaried, time-limited, client-focused, professional, purposeful. Social: Mutual exchange, no formal boundaries, ongoing, personal. The counselor maintains professional boundaries at all times.',
  'Terapéutica: Con límites, limitada en el tiempo, centrada en el cliente, profesional, con propósito. Social: Intercambio mutuo, sin límites formales, continua, personal.',
  'Thérapeutique : Délimitée, limitée dans le temps, centrée sur le client, professionnelle, intentionnelle. Sociale : Échange mutuel, sans limites formelles, continue, personnelle.',
  true
),
(
  (SELECT id FROM exams WHERE slug='ccm'),
  'What is the PDSA cycle in quality improvement?',
  '¿Qué es el ciclo PDSA en la mejora de la calidad?',
  'Qu''est-ce que le cycle PDSA dans l''amélioration de la qualité ?',
  'Plan-Do-Study-Act. A continuous quality improvement framework: Plan (identify problem and plan change), Do (implement on small scale), Study (analyze data and results), Act (standardize if successful or adjust and repeat).',
  'Planificar-Hacer-Estudiar-Actuar. Un marco de mejora continua de la calidad para identificar problemas, implementar cambios, analizar resultados y estandarizar.',
  'Planifier-Faire-Étudier-Agir. Un cadre d''amélioration continue de la qualité pour identifier les problèmes, mettre en œuvre des changements, analyser les résultats et standardiser.',
  true
);

-- ============================================================
-- CASE VIGNETTES: EPPP
-- ============================================================
INSERT INTO case_vignettes (exam_id, topic_id, case_en, case_es, case_fr, prompt_en, prompt_es, prompt_fr, ideal_answer_en, ideal_answer_es, ideal_answer_fr, coaching_feedback_en, coaching_feedback_es, coaching_feedback_fr, active)
VALUES
(
  (SELECT id FROM exams WHERE slug='eppp'),
  (SELECT id FROM topics WHERE title='Treatment & Intervention' AND exam_id=(SELECT id FROM exams WHERE slug='eppp')),
  'Dr. Martinez is a licensed psychologist seeing Maria, a 34-year-old Latina woman who presents with significant depressive symptoms following a divorce. During the third session, Maria discloses that her previous therapist had told her that he had romantic feelings for her, and that she had felt confused and obligated to continue the relationship. Maria is now distrustful of therapy. Maria states: "Maybe therapy just isn''t for people like me."',
  'La Dra. Martínez es una psicóloga licenciada que atiende a María, una mujer latina de 34 años que presenta síntomas depresivos significativos tras un divorcio. Durante la tercera sesión, María revela que su terapeuta anterior le dijo que tenía sentimientos románticos por ella, y que se sintió confundida y obligada a continuar la relación. María ahora desconfía de la terapia.',
  'La Dra. Martinez est une psychologue agréée qui reçoit Maria, une femme latina de 34 ans présentant des symptômes dépressifs significatifs après un divorce. Lors de la troisième séance, Maria révèle que son thérapeute précédent lui avait dit avoir des sentiments romantiques pour elle, et qu''elle s''était sentie confuse et obligée de continuer la relation. Maria se méfie maintenant de la thérapie.',
  'How should Dr. Martinez respond to Maria''s disclosure? What ethical and clinical considerations are most important in this situation?',
  '¿Cómo debe responder la Dra. Martínez a la revelación de María? ¿Qué consideraciones éticas y clínicas son más importantes en esta situación?',
  'Comment la Dra. Martinez doit-elle répondre à la divulgation de Maria ? Quelles considérations éthiques et cliniques sont les plus importantes dans cette situation ?',
  'Dr. Martinez should: (1) Validate Maria''s experience and name the previous therapist''s behavior as an ethical violation. (2) Affirm that romantic involvement with a current client is prohibited by APA ethics code (Standard 10.05). (3) Acknowledge the harm caused. (4) Explore Maria''s statement about therapy "not being for people like me" through a cultural lens — address potential internalized beliefs about access to mental health care. (5) Offer to provide information about reporting the previous therapist to the licensing board if Maria wishes. (6) Focus on rebuilding therapeutic alliance and trust.',
  'La Dra. Martínez debe: (1) Validar la experiencia de María y nombrar el comportamiento del terapeuta anterior como una violación ética. (2) Afirmar que la participación romántica está prohibida por el código de ética de la APA. (3) Reconocer el daño causado. (4) Explorar la afirmación de María desde una perspectiva cultural. (5) Ofrecer información sobre cómo denunciar al terapeuta anterior. (6) Centrarse en reconstruir la alianza terapéutica.',
  'La Dra. Martinez doit : (1) Valider l''expérience de Maria et qualifier le comportement du thérapeute précédent de violation éthique. (2) Affirmer que l''implication romantique est interdite par le code d''éthique de l''APA. (3) Reconnaître le préjudice causé. (4) Explorer la déclaration de Maria d''un point de vue culturel. (5) Offrir des informations sur la façon de signaler le thérapeute précédent. (6) Se concentrer sur la reconstruction de l''alliance thérapeutique.',
  'Strong responses identify the ethical violation clearly, address the cultural component of Maria''s statement, and propose concrete steps to rebuild trust. Note that reporting the previous therapist may be mandatory in some states — be aware of your jurisdiction.',
  'Las respuestas sólidas identifican claramente la violación ética, abordan el componente cultural de la declaración de María y proponen pasos concretos para reconstruir la confianza.',
  'Les réponses solides identifient clairement la violation éthique, abordent la composante culturelle de la déclaration de Maria et proposent des étapes concrètes pour reconstruire la confiance.',
  true
);

-- ============================================================
-- CASE VIGNETTES: NCLEX
-- ============================================================
INSERT INTO case_vignettes (exam_id, topic_id, case_en, case_es, case_fr, prompt_en, prompt_es, prompt_fr, ideal_answer_en, ideal_answer_es, ideal_answer_fr, coaching_feedback_en, coaching_feedback_es, coaching_feedback_fr, active)
VALUES
(
  (SELECT id FROM exams WHERE slug='nclex'),
  (SELECT id FROM topics WHERE title='Patient Safety' AND exam_id=(SELECT id FROM exams WHERE slug='nclex')),
  'A 68-year-old male patient with a history of heart failure and atrial fibrillation is admitted for a COPD exacerbation. Current medications include furosemide 40mg daily, metoprolol 25mg twice daily, warfarin 5mg daily, and albuterol PRN. On assessment: BP 148/92, HR 58, RR 24, SpO2 89% on 2L O2 via nasal cannula. The patient is confused, diaphoretic, and using accessory muscles to breathe. Lab results show K+ 3.1 mEq/L, INR 3.8.',
  'Un hombre de 68 años con antecedentes de insuficiencia cardíaca y fibrilación auricular es ingresado por una exacerbación de EPOC. Medicamentos actuales: furosemida 40mg diarios, metoprolol 25mg dos veces al día, warfarina 5mg diarios y albuterol PRN. Evaluación: PA 148/92, FC 58, FR 24, SpO2 89% con 2L O2. El paciente está confuso, diaforético y usa músculos accesorios para respirar. Laboratorio: K+ 3.1, INR 3.8.',
  'Un homme de 68 ans avec antécédents d''insuffisance cardiaque et de fibrillation auriculaire est admis pour une exacerbation de BPCO. Médicaments actuels : furosémide 40mg/j, métoprolol 25mg deux fois/j, warfarine 5mg/j, albutérol PRN. Évaluation : PA 148/92, FC 58, FR 24, SpO2 89% sous 2L O2. Le patient est confus, diaphorétique, utilise les muscles accessoires. K+ 3,1, INR 3,8.',
  'Identify the priority nursing concerns and describe your immediate nursing actions for this patient. Include your rationale.',
  'Identifique las preocupaciones prioritarias de enfermería y describa sus acciones inmediatas para este paciente. Incluya su fundamento.',
  'Identifiez les préoccupations infirmières prioritaires et décrivez vos actions infirmières immédiates pour ce patient. Incluez votre raisonnement.',
  'Priority concerns: (1) Respiratory distress — SpO2 89% with accessory muscle use is the immediate life threat. Increase O2 delivery (upgrade to face mask), position patient upright, prepare for bronchodilator treatment. Notify provider. (2) Hypokalemia (K+ 3.1) — furosemide is likely contributing; K+ <3.5 requires monitoring and likely replacement; also increases risk of digoxin toxicity and arrhythmias. (3) Supratherapeutic INR (3.8) — therapeutic range is 2-3 for AFib; hold warfarin and notify provider. (4) Bradycardia (HR 58) — hold metoprolol given HR <60; monitor. Prioritize airway and breathing first (Maslow, ABC).',
  'Preocupaciones prioritarias: (1) Dificultad respiratoria — SpO2 89% con uso de músculos accesorios es la amenaza inmediata. Aumentar O2, posicionar al paciente erguido, preparar broncodilatadores. (2) Hipopotasemia (K+ 3.1) — monitorear y reponer. (3) INR supraterapeútico (3.8) — retener warfarina. (4) Bradicardia (FC 58) — retener metoprolol.',
  'Préoccupations prioritaires : (1) Détresse respiratoire — SpO2 89% avec muscles accessoires est la menace immédiate. Augmenter O2, positionner assis, préparer bronchodilatateurs. (2) Hypokaliémie (K+ 3,1) — surveiller et remplacer. (3) INR suprathérapeutique (3,8) — retenir warfarine. (4) Bradycardie (FC 58) — retenir métoprolol.',
  'Excellent responses prioritize ABC (airway, breathing, circulation) and address each abnormal finding with a clear rationale. Note that the nurse should document all interventions and reassess frequently. The combination of furosemide and low K+ is a classic NCLEX trap.',
  'Las respuestas excelentes priorizan ABC (vía aérea, respiración, circulación) y abordan cada hallazgo anormal con fundamento claro. Nota que la enfermera debe documentar todas las intervenciones y reevaluar con frecuencia.',
  'Les réponses excellentes priorisent l''ABC (voies aériennes, respiration, circulation) et traitent chaque résultat anormal avec un raisonnement clair. Notez que l''infirmière doit documenter toutes les interventions et réévaluer fréquemment.',
  true
);

-- ============================================================
-- CASE VIGNETTES: Social Work
-- ============================================================
INSERT INTO case_vignettes (exam_id, topic_id, case_en, case_es, case_fr, prompt_en, prompt_es, prompt_fr, ideal_answer_en, ideal_answer_es, ideal_answer_fr, coaching_feedback_en, coaching_feedback_es, coaching_feedback_fr, active)
VALUES
(
  (SELECT id FROM exams WHERE slug='social-work'),
  (SELECT id FROM topics WHERE title='Clinical Practice' AND exam_id=(SELECT id FROM exams WHERE slug='social-work')),
  'James is a 45-year-old African American male referred by his primary care physician for depression following a heart attack six months ago. He is reluctant to engage in therapy, stating: "I can handle my own problems." He reports feeling "down" but denies sadness, explaining: "Men in my family don''t complain." He has stopped exercising, is sleeping 10+ hours, and his wife reports he has become increasingly irritable and withdrawn.',
  'James es un hombre afroamericano de 45 años derivado por su médico de cabecera por depresión tras un infarto hace seis meses. Es reacio a participar en la terapia: "Puedo manejar mis propios problemas." Reporta sentirse "abatido" pero niega tristeza: "Los hombres de mi familia no se quejan." Ha dejado de hacer ejercicio, duerme más de 10 horas y su esposa reporta que está cada vez más irritable y retraído.',
  'James est un homme afro-américain de 45 ans référé par son médecin traitant pour dépression suite à une crise cardiaque il y a six mois. Il est réticent à s''engager en thérapie : "Je peux gérer mes propres problèmes." Il rapporte se sentir "abattu" mais nie la tristesse : "Les hommes de ma famille ne se plaignent pas." Il a arrêté de faire de l''exercice, dort plus de 10 heures et sa femme rapporte qu''il est de plus en plus irritable et retiré.',
  'What cultural factors should the social worker consider in their approach to James? What treatment approach would you recommend and why?',
  '¿Qué factores culturales debe considerar el trabajador social en su enfoque con James? ¿Qué enfoque de tratamiento recomendaría y por qué?',
  'Quels facteurs culturels le travailleur social doit-il considérer dans son approche de James ? Quelle approche de traitement recommanderiez-vous et pourquoi ?',
  'Cultural considerations: (1) Gender norms — Black masculinity norms may discourage emotional expression. Reframe depression as a medical condition affecting physical health (link to heart attack). (2) Historical mistrust of healthcare systems in African American communities. (3) Somatic presentation — James expresses depression through physical symptoms (fatigue, irritability) and behavioral changes rather than sadness. This is common across cultures and genders. Treatment approach: (1) Motivational interviewing to build engagement. (2) Psychoeducation using medical model (post-cardiac depression is a recognized medical condition with evidence-based treatment). (3) CBT with behavioral activation — focus on concrete behavioral goals rather than exploring feelings initially. (4) Involve wife in psychoeducation with James''s consent. (5) Coordinate with PCP regarding antidepressant evaluation.',
  'Consideraciones culturales: (1) Normas de género — las normas de masculinidad negra pueden desalentar la expresión emocional. Reencuadrar la depresión como condición médica. (2) Desconfianza histórica en sistemas de salud. (3) Presentación somática. Enfoque: (1) Entrevista motivacional. (2) Psicoeducación con modelo médico. (3) TCC con activación conductual. (4) Involucrar a la esposa con consentimiento. (5) Coordinación con médico de cabecera.',
  'Considérations culturelles : (1) Normes de genre — les normes de masculinité noire peuvent décourager l''expression émotionnelle. Recadrer la dépression comme une condition médicale. (2) Méfiance historique envers les systèmes de santé. (3) Présentation somatique. Approche : (1) Entretien motivationnel. (2) Psychoéducation avec modèle médical. (3) TCC avec activation comportementale. (4) Impliquer l''épouse avec consentement. (5) Coordination avec le médecin.',
  'Strong responses integrate cultural humility, recognize the somatic presentation of depression, and select evidence-based treatments that align with the client''s worldview. Avoid assuming James is non-compliant — his reluctance is clinically meaningful information.',
  'Las respuestas sólidas integran la humildad cultural, reconocen la presentación somática de la depresión y seleccionan tratamientos basados en evidencia que se alinean con la cosmovisión del cliente.',
  'Les réponses solides intègrent l''humilité culturelle, reconnaissent la présentation somatique de la dépression et sélectionnent des traitements fondés sur des preuves qui s''alignent sur la vision du monde du client.',
  true
);
