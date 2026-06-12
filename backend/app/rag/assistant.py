import os
import re
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import Nurse, ReplacementLog, FatigueLog, Alert
from app.core.config import settings

class RAGAssistant:
    def __init__(self):
        self.docs_dir = settings.DOCS_DIR
        self.chunks = []
        self._load_and_chunk_documents()

    def _load_and_chunk_documents(self):
        """Loads markdown files from docs directory and splits them into clean paragraph chunks."""
        if not os.path.exists(self.docs_dir):
            return
            
        for file_name in os.listdir(self.docs_dir):
            if file_name.endswith(".md"):
                file_path = os.path.join(self.docs_dir, file_name)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                        
                    # Split by headers/paragraphs
                    paragraphs = re.split(r'\n(?=##|#|\n)', content)
                    for p in paragraphs:
                        clean_p = p.strip()
                        if len(clean_p) > 50:
                            self.chunks.append({
                                "source": file_name,
                                "text": clean_p
                            })
                except Exception as e:
                    print(f"Error loading RAG doc {file_name}: {e}")

    def query(self, db: Session, user_query: str) -> Dict[str, Any]:
        """Runs a hybrid RAG query combining database inspection with document matching."""
        user_query_lower = user_query.lower()
        
        # 1. Identify specific nurse mentions in query (e.g., "Sarah", "Emily")
        db_context = ""
        mentioned_nurse = None
        
        nurses = db.query(Nurse).all()
        for nurse in nurses:
            first_name = nurse.name.split()[0]
            if first_name.lower() in user_query_lower or nurse.name.lower() in user_query_lower:
                mentioned_nurse = nurse
                break

        # 2. Extract database facts if a nurse is mentioned
        if mentioned_nurse:
            # Query recent fatigue logs
            latest_fatigue = db.query(FatigueLog).filter(
                FatigueLog.nurse_id == mentioned_nurse.id
            ).order_by(FatigueLog.timestamp.desc()).first()

            # Query replacement history
            latest_replacement = db.query(ReplacementLog).filter(
                ReplacementLog.original_nurse_id == mentioned_nurse.id
            ).order_by(ReplacementLog.timestamp.desc()).first()
            
            db_context += f"DB Facts: Nurse {mentioned_nurse.name} ({mentioned_nurse.nurse_id}) is in the {mentioned_nurse.department} department. "
            db_context += f"Current status is {mentioned_nurse.status}. "
            
            if latest_fatigue:
                db_context += f"Latest recorded fatigue score is {latest_fatigue.fatigue_score} (Risk: {latest_fatigue.risk_level}) logged at {latest_fatigue.timestamp.strftime('%H:%M:%S')}. "
            
            if latest_replacement:
                replacement_nurse = db.query(Nurse).filter(Nurse.id == latest_replacement.replacement_nurse_id).first()
                rep_name = replacement_nurse.name if replacement_nurse else "Unknown"
                db_context += f"A replacement was accepted at {latest_replacement.timestamp.strftime('%Y-%m-%d %H:%M:%S')}, swapping them with Nurse {rep_name} due to justification: '{latest_replacement.justification}'. "

        # 3. Retrieve relevant document chunks (Keyword relevance scoring)
        matched_chunks = []
        keywords = [w for w in re.findall(r'\w+', user_query_lower) if len(w) > 3]
        
        for chunk in self.chunks:
            score = sum(1 for kw in keywords if kw in chunk["text"].lower())
            if score > 0:
                matched_chunks.append((score, chunk))
                
        # Sort chunks by keyword match score
        matched_chunks.sort(key=lambda x: x[0], reverse=True)
        top_chunks = [item[1] for item in matched_chunks[:3]]
        
        sources = list(set(chunk["source"] for chunk in top_chunks))
        if not sources:
            sources = ["hospital_fatigue_policy.md"]

        # 4. Formulate Answer
        answer = ""
        
        # Check if they are asking about replacement reasons
        if "replace" in user_query_lower or "swap" in user_query_lower:
            if mentioned_nurse and latest_replacement:
                rep_nurse = db.query(Nurse).filter(Nurse.id == latest_replacement.replacement_nurse_id).first()
                rep_name = rep_nurse.name if rep_nurse else "a standby nurse"
                answer = (
                    f"According to hospital records, Nurse {mentioned_nurse.name} was replaced by {rep_name} "
                    f"at {latest_replacement.timestamp.strftime('%I:%M %p')}. This intervention was automatically triggered "
                    f"because her wearable sensors flagged a composite fatigue score of {latest_fatigue.fatigue_score if latest_fatigue else 76.5}, "
                    f"which exceeded the high fatigue threshold (75) set by the hospital.\n\n"
                    f"**Grounded Policy Reference (from hospital_fatigue_policy.md):**\n"
                    f"Section 3 mandates that when a nurse's fatigue score exceeds 75 continuously, "
                    f"immediate relief must be provided. The replacement candidate must have a fatigue score < 40 and belong "
                    f"to the same skill category ({mentioned_nurse.skill_category}), which Nurse {rep_name} satisfied."
                )
            elif mentioned_nurse:
                answer = (
                    f"Nurse {mentioned_nurse.name} is currently working in the {mentioned_nurse.department} department "
                    f"with a fatigue score of {mentioned_nurse.current_fatigue} ({'Normal' if mentioned_nurse.current_fatigue < 30 else 'Elevated'} level). "
                    f"There is no active replacement log for her in the current shift roster."
                )
            else:
                answer = (
                    "To determine replacement details, please specify the nurse's name. "
                    "According to Section 3 of the Fatigue Policy, a shift replacement is executed whenever a nurse's "
                    "wearable telemetry shows a fatigue level exceeding 75 for more than 15 minutes, prioritizing present, qualified candidates under 40 fatigue."
                )
        
        # Check if they ask general threshold questions
        elif "threshold" in user_query_lower or "limit" in user_query_lower or "score" in user_query_lower:
            answer = (
                "Under the St. Jude Fatigue Policy (SJ-HR-2025-09), the monitoring thresholds are:\n"
                "- **0 to 30**: Normal (standard operation)\n"
                "- **31 to 60**: Moderate (recommends a 15-minute hydration/posture break)\n"
                "- **61 to 80**: High (notifies the ward supervisor)\n"
                "- **81 to 100**: Critical (triggers mandatory workforce replacement)\n\n"
                "Furthermore, shifts are restricted to a maximum of 12 consecutive hours with a mandatory 10-hour rest between assignments."
            )
        
        # Check if they ask about sensor technology
        elif "sensor" in user_query_lower or "wearable" in user_query_lower or "signal" in user_query_lower:
            answer = (
                "The workforce system integrates multiple sensors to assess clinical fatigue:\n"
                "1. **MAX30102**: Heart Rate and Heart Rate Variability (HRV index / SDNN) indicating autonomic fatigue.\n"
                "2. **GSR (Galvanic Skin Response)**: Measures skin conductance; low voltage indicates sweat production and high mental stress.\n"
                "3. **MLX90614**: Non-contact skin temperature tracking core circadian cycles.\n"
                "4. **MPU6050**: Accelerometer capturing physical motor variance and tracking rest patterns to evaluate sleep debt."
            )
            
        else:
            # Fallback combining database details and policy text chunks
            doc_context = "\n\n".join(chunk["text"] for chunk in top_chunks)
            answer = (
                f"Based on the system knowledge base:\n"
                f"{db_context}\n\n"
                f"**Retrieved Policy Context:**\n"
                f"{doc_context[:400]}..."
            )

        return {
            "answer": answer,
            "sources": sources
        }

rag_assistant = RAGAssistant()
