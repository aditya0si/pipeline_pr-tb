import { useState } from "react";

interface Props {
  onBack: () => void;
}

const CATEGORIES = [
  {
    id: "chronic", name: "Chronic Conditions", icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
    articles: [
      { title: "Understanding Diabetes", content: "Type 2 diabetes is a chronic condition affecting how your body metabolizes sugar (glucose). Key management strategies include:\n\n• Regular blood glucose monitoring\n• Balanced diet with controlled carbohydrate intake\n• Regular physical activity (150 min/week)\n• Medication adherence as prescribed\n• Regular A1C testing every 3 months\n• Annual eye, kidney, and foot exams\n\nTarget blood sugar levels:\n- Before meals: 80-130 mg/dL\n- 2 hours after meals: Less than 180 mg/dL\n- A1C: Less than 7%" },
      { title: "Managing Hypertension", content: "High blood pressure (hypertension) is often called the 'silent killer' because it usually has no symptoms.\n\nLifestyle modifications:\n• Reduce sodium intake (< 2,300 mg/day)\n• DASH diet (fruits, vegetables, whole grains)\n• Regular exercise (30 min most days)\n• Maintain healthy weight\n• Limit alcohol consumption\n• Quit smoking\n• Manage stress\n\nBlood pressure categories:\n- Normal: < 120/80 mmHg\n- Elevated: 120-129/< 80 mmHg\n- Stage 1: 130-139/80-89 mmHg\n- Stage 2: ≥ 140/≥ 90 mmHg" },
      { title: "Living with Asthma", content: "Asthma is a chronic condition where airways narrow, swell, and produce extra mucus.\n\nAction plan essentials:\n• Know your triggers (allergens, exercise, cold air)\n• Use controller medications daily as prescribed\n• Keep rescue inhaler accessible at all times\n• Monitor peak flow readings\n• Follow your Asthma Action Plan zones\n\nGreen Zone: Doing well, no symptoms\nYellow Zone: Getting worse, use quick-relief medicine\nRed Zone: Medical emergency, call 911" },
    ],
  },
  {
    id: "preventive", name: "Preventive Care", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    articles: [
      { title: "Recommended Screenings by Age", content: "Regular health screenings detect problems early.\n\nAges 18-39:\n• Blood pressure: Every 2 years\n• Cholesterol: Every 4-6 years\n• Dental checkup: Every 6 months\n• Eye exam: Every 2 years\n\nAges 40-49:\n• Blood pressure: Annually\n• Diabetes screening: Every 3 years\n• Mammogram (women): Annually from 40\n\nAges 50+:\n• Colonoscopy: Every 10 years\n• Bone density: Women at 65\n• Prostate screening: Discuss with doctor\n• Annual flu and pneumonia vaccines" },
      { title: "Vaccination Schedule (Adults)", content: "Stay up to date with recommended vaccines:\n\n• Influenza (Flu): Annually\n• Tdap/Td: Every 10 years\n• Shingles (Zoster): Age 50+, 2 doses\n• Pneumococcal: Age 65+\n• COVID-19: Per current CDC guidelines\n• Hepatitis B: If not previously vaccinated\n• HPV: Up to age 45 if not completed\n\nTravel vaccines:\n• Hepatitis A\n• Typhoid\n• Yellow Fever\n• Malaria prophylaxis (medication)" },
    ],
  },
  {
    id: "nutrition", name: "Nutrition & Diet", icon: "M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z",
    articles: [
      { title: "Heart-Healthy Diet", content: "A heart-healthy diet can reduce your risk of heart disease.\n\nFoods to include:\n• Fruits and vegetables (5+ servings/day)\n• Whole grains (oats, brown rice, quinoa)\n• Lean proteins (fish, poultry, legumes)\n• Healthy fats (olive oil, avocado, nuts)\n• Omega-3 fatty acids (salmon, walnuts)\n\nFoods to limit:\n• Saturated fats (< 7% of calories)\n• Trans fats (avoid completely)\n• Sodium (< 2,300 mg/day)\n• Added sugars (< 25g women, < 36g men)\n• Processed meats" },
      { title: "Diabetic Meal Planning", content: "The plate method is a simple way to plan balanced meals:\n\n🍽 Your Plate:\n• Half: Non-starchy vegetables\n• Quarter: Lean protein\n• Quarter: Carbohydrates/grains\n\nCarb counting basics:\n• 1 serving = 15g carbs\n• Most adults: 3-5 servings per meal\n• Snacks: 1-2 servings\n\nGlycemic Index awareness:\n- Low GI (< 55): Most fruits, legumes, whole grains\n- Medium GI (56-69): Whole wheat, sweet potato\n- High GI (> 70): White bread, white rice, potatoes" },
    ],
  },
  {
    id: "mental", name: "Mental Health", icon: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm3 8H9v-1c0-1 2-1.5 3-1.5s3 .5 3 1.5z",
    articles: [
      { title: "Recognizing Depression", content: "Depression is more than feeling sad. Seek help if you experience 5+ symptoms for 2+ weeks:\n\n• Persistent sad or empty mood\n• Loss of interest in activities\n• Changes in appetite or weight\n• Sleep disturbances\n• Fatigue or loss of energy\n• Feelings of worthlessness or guilt\n• Difficulty concentrating\n• Thoughts of death or suicide\n\nTreatment options:\n• Psychotherapy (CBT, IPT)\n• Medication (SSRIs, SNRIs)\n• Exercise (proven to reduce symptoms)\n• Social support\n• Mindfulness and meditation\n\n🆘 Crisis: Call 988 (Suicide & Crisis Lifeline)" },
      { title: "Stress Management Techniques", content: "Chronic stress affects physical and mental health.\n\nImmediate relief:\n• Deep breathing (4-7-8 technique)\n• Progressive muscle relaxation\n• Grounding (5-4-3-2-1 senses)\n\nDaily practices:\n• Exercise (30 min/day)\n• Adequate sleep (7-9 hours)\n• Healthy diet\n• Social connections\n• Time in nature\n• Journaling\n\nLong-term strategies:\n• Set boundaries\n• Time management\n• Regular relaxation\n• Professional counseling\n• Meditation/yoga practice" },
    ],
  },
  {
    id: "medication", name: "Medication Safety", icon: "M10.5 1.5H8A6.5 6.5 0 0 0 8 14.5h8A6.5 6.5 0 0 0 16 1.5h-2.5",
    articles: [
      { title: "Medication Adherence", content: "Taking medications as prescribed is crucial for treatment success.\n\nTips for adherence:\n• Use a pill organizer\n• Set daily alarms/reminders\n• Keep a medication log\n• Refill prescriptions early\n• Never skip doses without consulting your doctor\n\nWhat to tell your doctor:\n• All medications (including OTC)\n• Supplements and vitamins\n• Side effects you're experiencing\n• If you've missed doses\n• Allergies to medications\n\nDanger signs — call your doctor:\n• Unexpected side effects\n• Allergic reactions (rash, swelling, breathing difficulty)\n• Worsening symptoms" },
    ],
  },
];

export function PatientEducation({ onBack }: Props) {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);

  const cat = CATEGORIES.find(c => c.id === selectedCat);

  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        {selectedCat && <><button onClick={() => { setSelectedCat(null); setSelectedArticle(null); }}>Education</button><span className="sep">/</span></>}
        <span>{selectedArticle ? selectedArticle.title : selectedCat ? cat?.name : "Patient Education"}</span>
      </div>
      <div className="section-header">
        <div>
          <h1>{selectedArticle ? selectedArticle.title : "Patient Education Library"}</h1>
          <div className="subtitle">{selectedArticle ? cat?.name : "Evidence-based health information for patients and families"}</div>
        </div>
      </div>

      {!selectedCat && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {CATEGORIES.map(c => (
            <div key={c.id} className="neu" style={{ padding: 24, cursor: "pointer" }} onClick={() => setSelectedCat(c.id)}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon}/></svg>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{c.name}</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.articles.length} article{c.articles.length > 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      )}

      {selectedCat && !selectedArticle && cat && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="neu-btn sm ghost" onClick={() => setSelectedCat(null)} style={{ alignSelf: "flex-start", marginBottom: 8 }}>← All Categories</button>
          {cat.articles.map((article, i) => (
            <div key={i} className="neu" style={{ padding: 20, cursor: "pointer" }} onClick={() => setSelectedArticle(article)}>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{article.title}</h4>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{article.content.slice(0, 100)}...</p>
            </div>
          ))}
        </div>
      )}

      {selectedArticle && (
        <div>
          <button className="neu-btn sm ghost" onClick={() => setSelectedArticle(null)} style={{ marginBottom: 16 }}>← Back to {cat?.name}</button>
          <div className="neu" style={{ padding: 28 }}>
            <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", color: "var(--text-secondary)" }}>
              {selectedArticle.content}
            </div>
            <div style={{ marginTop: 20, padding: "12px 16px", background: "var(--bg-alt)", borderRadius: 8, fontSize: 11, color: "var(--text-muted)" }}>
              This information is for educational purposes only and does not replace professional medical advice. Always consult your healthcare provider for personalized guidance.
            </div>
          </div>
          <button className="neu-btn sm ghost" style={{ marginTop: 12 }} onClick={() => {
            const blob = new Blob([`${selectedArticle.title}\n\n${selectedArticle.content}`], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `${selectedArticle.title.replace(/\s/g, "_")}.txt`; a.click();
            URL.revokeObjectURL(url);
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download as Text
          </button>
        </div>
      )}
    </div>
  );
}
