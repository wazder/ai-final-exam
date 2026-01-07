from flask import Flask, render_template, jsonify, request, session
import json
import os
import markdown
import re

app = Flask(__name__)
app.secret_key = 'ai-final-exam-secret-key-2026'

# Mock data - 3 örnek soru
MOCK_QUESTIONS = [
    {
        "id": 1,
        "code": "SN1-1",
        "category": "Python",
        "question": "Python'da bir listeyi tersine çevirmek için hangi metod kullanılır?",
        "options": ["reverse()", "flip()", "invert()", "backward()"],
        "correct": 0,
        "explanation": "Python'da liste.reverse() metodu listeyi yerinde tersine çevirir."
    },
    {
        "id": 2,
        "code": "SN1-2",
        "category": "Flask",
        "question": "Flask framework'ünde route tanımlamak için hangi dekoratör kullanılır?",
        "options": ["@route", "@app.route", "@flask.route", "@url"],
        "correct": 1,
        "explanation": "@app.route dekoratörü Flask'ta URL yönlendirmesi için kullanılır."
    },
    {
        "id": 3,
        "code": "SN1-3",
        "category": "HTML",
        "question": "HTML'de bir bağlantı oluşturmak için hangi etiket kullanılır?",
        "options": ["<link>", "<href>", "<a>", "<url>"],
        "correct": 2,
        "explanation": "<a> (anchor) etiketi HTML'de hyperlink oluşturmak için kullanılır."
    }
]

def load_questions():
    """Soruları yükle - data klasöründeki tüm md dosyalarını oku"""
    data_path = os.path.join(os.path.dirname(__file__), 'data')
    all_questions = []
    
    # Data klasörü varsa tüm .md dosyalarını oku
    if os.path.exists(data_path) and os.path.isdir(data_path):
        md_files = sorted([f for f in os.listdir(data_path) if f.endswith('.md')],
                         key=lambda x: int(re.search(r'\d+', x).group()) if re.search(r'\d+', x) else 0)
        
        for md_file in md_files:
            filepath = os.path.join(data_path, md_file)
            # Dosya adından slayt numarasını çıkar (s1.md -> Slayt 1, s10.md -> Slayt 10)
            slide_match = re.match(r's(\d+)\.md', md_file, re.IGNORECASE)
            slide_category = f"Slayt {slide_match.group(1)}" if slide_match else "Diğer"
            
            questions = parse_questions_from_md(filepath, slide_category)
            all_questions.extend(questions)
        
        # ID'leri yeniden sırala
        for i, q in enumerate(all_questions, 1):
            q['id'] = i
        
        if all_questions:
            return all_questions
    
    # Eski questions.md dosyasını kontrol et
    md_path = os.path.join(os.path.dirname(__file__), 'questions.md')
    if os.path.exists(md_path):
        return parse_questions_from_md(md_path, "Genel")
    
    return MOCK_QUESTIONS

def parse_questions_from_md(filepath, slide_category="Genel"):
    """MD dosyasından soruları parse et"""
    questions = []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Soruları ayır (--- veya boş satırlarla ayrılmış bloklar)
    # Önce eski format (## Soru X) kontrolü
    if re.search(r'## Soru \d+', content) and not re.search(r'SN\d+-\d+', content):
        return parse_old_format(content, slide_category)
    
    # Yeni format: ### **SN9-3 (FP)** şeklinde
    # Soruları horizontal rule (---) ile ayır
    blocks = re.split(r'\n-{3,}\n', content)
    
    question_id = 0
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        
        # Total: X Questions satırını atla
        if 'Total:' in block and 'Questions' in block and len(block.split('\n')) <= 2:
            continue
        
        lines = block.split('\n')
        
        code = ""
        fp_tag = ""  # FP bilgisi
        question_text = ""
        options = []
        correct = 0
        
        i = 0
        
        # İlk satırda ### **SN10-1 (FP)** formatını ara
        for idx, line in enumerate(lines):
            line_clean = line.strip()
            # ### **SN10-1 (FP)** veya ### **SN1-5** formatı
            code_match = re.search(r'\*\*([A-Za-z0-9\-]+)\s*(?:\(([^)]+)\))?\*\*', line_clean)
            if code_match:
                code = code_match.group(1)
                fp_tag = code_match.group(2) if code_match.group(2) else ""
                i = idx + 1
                break
            # Düz format: SN9-3 (FP)
            code_match2 = re.match(r'^([A-Za-z0-9\-]+)\s*\(([^)]+)\)', line_clean)
            if code_match2:
                code = code_match2.group(1)
                fp_tag = code_match2.group(2)
                i = idx + 1
                break
        
        # Soru metnini bul
        while i < len(lines):
            line = lines[i].strip()
            # Seçenekler başlıyor mu?
            if re.match(r'^[A-D]\)', line):
                break
            # Boş satır veya başlık değilse soru metnine ekle
            if line and not line.startswith('#') and not line.startswith('**Soru') and not line.startswith('Total:'):
                if line.startswith('**Soru:**'):
                    question_text = line.replace('**Soru:**', '').strip()
                else:
                    question_text += (" " if question_text else "") + line
            i += 1
        
        # Seçenekleri bul
        while i < len(lines):
            line = lines[i].strip()
            if line.startswith('**Correct Answer:') or line.startswith('Correct Answer:') or line.startswith('**Doğru Cevap:'):
                break
            
            # A) format
            option_match = re.match(r'^([A-D])\)?\s*(.+)', line)
            if option_match:
                options.append(option_match.group(2).strip())
            # - A) format
            elif line.startswith('- '):
                opt_match = re.match(r'^- ([A-D])\)\s*(.+)', line)
                if opt_match:
                    options.append(opt_match.group(2).strip())
            i += 1
        
        # Doğru cevabı bul
        while i < len(lines):
            line = lines[i].strip()
            correct_match = re.match(r'^(?:\*\*Correct Answer:\*\*|Correct Answer:|\*\*Doğru Cevap:\*\*)\s*([A-D])', line)
            if correct_match:
                correct = ord(correct_match.group(1).upper()) - ord('A')
                break
            i += 1
        
        if question_text and len(options) >= 2:
            question_id += 1
            questions.append({
                "id": question_id,
                "code": code,
                "category": slide_category,  # Slayt kategorisi (Slayt 1, Slayt 2, vb.)
                "fp_tag": fp_tag,  # FP bilgisi
                "question": question_text.strip(),
                "options": options,
                "correct": correct,
                "explanation": f"Doğru cevap: {chr(ord('A') + correct)}"
            })
    
    return questions if questions else []


def parse_old_format(content, slide_category="Genel"):
    """Eski format için parser (## Soru X)"""
    questions = []
    question_blocks = re.split(r'\n## Soru \d+', content)
    
    for i, block in enumerate(question_blocks[1:], 1):
        lines = block.strip().split('\n')
        
        question_text = ""
        options = []
        correct = 0
        explanation = ""
        
        current_section = None
        
        for line in lines:
            line = line.strip()
            
            if line.startswith('**Soru:**'):
                current_section = 'question'
                question_text = line.replace('**Soru:**', '').strip()
            elif line.startswith('**Seçenekler:**'):
                current_section = 'options'
            elif line.startswith('**Doğru Cevap:**'):
                current_section = 'correct'
                correct_letter = line.replace('**Doğru Cevap:**', '').strip().upper()
                correct = ord(correct_letter) - ord('A')
            elif line.startswith('**Açıklama:**'):
                current_section = 'explanation'
                explanation = line.replace('**Açıklama:**', '').strip()
            elif current_section == 'question' and line and not line.startswith('**'):
                question_text += ' ' + line
            elif current_section == 'options' and line.startswith('- '):
                option_text = re.sub(r'^- [A-D]\) ', '', line)
                options.append(option_text)
            elif current_section == 'explanation' and line and not line.startswith('**'):
                explanation += ' ' + line
        
        if question_text and options:
            questions.append({
                "id": i,
                "code": "",
                "category": "",
                "question": question_text.strip(),
                "options": options,
                "correct": correct,
                "explanation": explanation.strip() if explanation else f"Doğru cevap: {chr(ord('A') + correct)}"
            })
    
    return questions

@app.route('/')
def index():
    """Ana sayfa"""
    questions = load_questions()
    return render_template('index.html', total_questions=len(questions))

@app.route('/api/questions')
def get_questions():
    """Tüm soruları JSON olarak döndür"""
    questions = load_questions()
    # Doğru cevapları gizle
    safe_questions = []
    for q in questions:
        safe_questions.append({
            "id": q["id"],
            "code": q.get("code", ""),
            "category": q.get("category", ""),
            "question": q["question"],
            "options": q["options"]
        })
    return jsonify(safe_questions)

@app.route('/api/check', methods=['POST'])
def check_answer():
    """Cevabı kontrol et"""
    data = request.json
    question_id = data.get('question_id')
    answer = data.get('answer')
    
    questions = load_questions()
    
    for q in questions:
        if q["id"] == question_id:
            is_correct = q["correct"] == answer
            return jsonify({
                "correct": is_correct,
                "correct_answer": q["correct"],
                "explanation": q["explanation"]
            })
    
    return jsonify({"error": "Soru bulunamadı"}), 404

@app.route('/api/stats', methods=['POST'])
def save_stats():
    """İstatistikleri kaydet"""
    data = request.json
    # Session'a kaydet
    session['correct'] = data.get('correct', 0)
    session['wrong'] = data.get('wrong', 0)
    session['total'] = data.get('total', 0)
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
