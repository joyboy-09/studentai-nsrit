"""
AI Engine for StudentAI.
Pure Python-based intelligent content generation - NO API keys needed.
Generates quizzes, flashcards, chat responses, math solutions, and tasks
entirely from the uploaded document content using NLP techniques.
"""

import re
import random
import math
from typing import List, Dict, Tuple
from collections import Counter


# ═══════════════════════════════════════════════════════════════════════════════
#  TEXT ANALYSIS UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def _clean_text(text: str) -> str:
    """Clean and normalize text."""
    text = re.sub(r'---\s*(Page|Slide)\s*\d+\s*---', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _split_sentences(text: str) -> List[str]:
    """Split text into meaningful sentences."""
    text = _clean_text(text)
    # Split on sentence boundaries
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
    # Also split on newlines that separate content
    expanded = []
    for s in sentences:
        parts = s.split('\n')
        expanded.extend(parts)
    
    # Filter: keep only meaningful sentences
    result = []
    for s in expanded:
        s = s.strip()
        if len(s) > 15 and len(s) < 500 and not s.startswith('---'):
            # Must have at least 3 words
            if len(s.split()) >= 3:
                result.append(s)
    return result


def _extract_paragraphs(text: str) -> List[str]:
    """Extract meaningful paragraphs from text."""
    text = re.sub(r'---\s*(Page|Slide)\s*\d+\s*---', '\n\n', text)
    paragraphs = text.split('\n\n')
    result = []
    for p in paragraphs:
        p = p.strip()
        if len(p) > 30 and len(p.split()) >= 5:
            result.append(p)
    return result


def _get_key_concepts(text: str) -> List[Dict[str, str]]:
    """Extract key concepts with their context from text."""
    sentences = _split_sentences(text)
    concepts = []
    
    # Find sentences that define or explain something
    definition_patterns = [
        r'(.+?)\s+(?:is|are|refers to|means|defined as|describes)\s+(.+)',
        r'(.+?)\s+(?:involves|includes|consists of|contains)\s+(.+)',
        r'(.+?)\s*[-:]\s*(.+)',
    ]
    
    for sentence in sentences:
        for pattern in definition_patterns:
            match = re.match(pattern, sentence, re.IGNORECASE)
            if match and len(match.group(1).split()) <= 6:
                term = match.group(1).strip().rstrip(',;:')
                definition = match.group(2).strip().rstrip('.')
                # Skip generic terms
                skip_terms = {'it', 'this', 'that', 'these', 'the process', 'the system',
                             'they', 'he', 'she', 'we', 'there', 'here', 'the'}
                if len(term) > 2 and len(definition) > 10 and term.lower() not in skip_terms:
                    # Skip if term starts with a pronoun
                    if not term.lower().startswith(('the ', 'a ', 'an ', 'it ', 'this ')):
                        concepts.append({
                            'term': term,
                            'definition': definition,
                            'full_sentence': sentence
                        })
                break
    
    return concepts


def _get_important_terms(text: str) -> List[str]:
    """Extract important terms using frequency and capitalization analysis."""
    text_clean = _clean_text(text)
    
    # Get capitalized phrases (likely proper nouns/terms)
    cap_phrases = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text_clean)
    
    # Filter out common sentence starters and short words
    common_starters = {'The', 'This', 'That', 'These', 'Those', 'It', 'In', 'On', 'At',
                       'For', 'To', 'From', 'By', 'With', 'An', 'As', 'Or', 'If', 'So',
                       'But', 'And', 'Not', 'Are', 'Is', 'Was', 'Were', 'Has', 'Have',
                       'Had', 'Can', 'May', 'Will', 'Each', 'They', 'Here', 'There',
                       'Some', 'Most', 'Also', 'Both', 'Such', 'When', 'Where', 'How'}
    cap_phrases = [p for p in cap_phrases if p not in common_starters and len(p) > 2]
    
    # Get words 5+ chars, count frequency
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text_clean.lower())
    
    # Remove common stop words
    stop_words = {
        'this', 'that', 'these', 'those', 'with', 'from', 'have', 'been',
        'were', 'they', 'their', 'there', 'which', 'would', 'could', 'should',
        'about', 'when', 'what', 'where', 'will', 'also', 'more', 'most',
        'other', 'some', 'than', 'them', 'then', 'into', 'only', 'very',
        'just', 'over', 'such', 'after', 'before', 'between', 'each',
        'through', 'during', 'because', 'both', 'same', 'different',
        'first', 'second', 'third', 'being', 'does', 'make', 'made',
        'many', 'much', 'well', 'back', 'even', 'still', 'while',
        'like', 'include', 'includes', 'including', 'involve', 'involves',
        'play', 'plays', 'role', 'form', 'forms', 'called', 'known',
        'used', 'uses', 'using', 'based', 'part', 'take', 'takes',
        'main', 'primary', 'important', 'essential', 'overall',
    }
    
    words = [w for w in words if w not in stop_words]
    word_freq = Counter(words)
    
    # Get top terms by frequency
    freq_terms = [word.title() for word, count in word_freq.most_common(25) if count >= 2]
    
    # Combine with capitalized phrases
    all_terms = list(dict.fromkeys(cap_phrases + freq_terms))  # preserve order, remove dupes
    return all_terms[:30]


def _find_facts(text: str) -> List[str]:
    """Extract factual statements from text."""
    sentences = _split_sentences(text)
    facts = []
    
    # Sentences with numbers, percentages, dates are likely facts
    fact_indicators = [
        r'\d+',  # contains numbers
        r'(?:is|are|was|were)\s+(?:a|an|the)',  # definitional
        r'(?:can|could|may|might)\s+',  # capability statements
        r'(?:used|uses|using)\s+(?:for|to|in)',  # usage statements
        r'(?:include|includes|such as|for example)',  # examples
        r'(?:important|key|main|primary|essential)',  # importance
    ]
    
    for sentence in sentences:
        score = 0
        for pattern in fact_indicators:
            if re.search(pattern, sentence, re.IGNORECASE):
                score += 1
        if score >= 1 and len(sentence.split()) >= 5:
            facts.append(sentence)
    
    return facts


def _find_related_sentences(query: str, sentences: List[str], top_k: int = 5) -> List[str]:
    """Find sentences most related to a query using keyword overlap."""
    query_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', query.lower()))
    
    scored = []
    for sentence in sentences:
        sent_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', sentence.lower()))
        overlap = len(query_words & sent_words)
        if overlap > 0:
            # Boost score if the overlap words are important (longer words)
            boost = sum(len(w) for w in query_words & sent_words) / 10
            scored.append((overlap + boost, sentence))
    
    scored.sort(reverse=True)
    return [s for _, s in scored[:top_k]]


# ═══════════════════════════════════════════════════════════════════════════════
#  DOCUMENT PROCESSING
# ═══════════════════════════════════════════════════════════════════════════════

def process_document(document_id: int, text: str) -> int:
    """Process a document - chunk the text for later use. Returns chunk count."""
    if not text.strip():
        return 0
    paragraphs = _extract_paragraphs(text)
    return max(len(paragraphs), 1)


# ═══════════════════════════════════════════════════════════════════════════════
#  QUIZ GENERATION - Interesting, learner-focused questions from material
# ═══════════════════════════════════════════════════════════════════════════════

def generate_quiz(document_id: int, text: str, num_questions: int) -> Dict:
    """Generate an engaging quiz strictly from document content."""
    sentences = _split_sentences(text)
    concepts = _get_key_concepts(text)
    facts = _find_facts(text)
    terms = _get_important_terms(text)
    
    if not sentences:
        return {"title": "Quiz", "questions": []}
    
    questions = []
    used_sentences = set()
    
    # Strategy 1: Fill-in-the-blank style (test recall)
    def make_fill_blank_question(sentence: str, idx: int) -> Dict:
        """Create a question by removing a key term from a factual sentence."""
        words = sentence.split()
        # Find important words (longer words, not at start)
        candidates = []
        for i, w in enumerate(words):
            clean_w = re.sub(r'[^a-zA-Z]', '', w)
            if len(clean_w) >= 4 and i > 0 and clean_w.lower() not in {'this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'their', 'which', 'would'}:
                candidates.append((i, clean_w))
        
        if not candidates:
            return None
        
        # Pick a word to blank out
        chosen_idx, chosen_word = random.choice(candidates)
        
        # Create the blank sentence
        blank_sentence = ' '.join(words[:chosen_idx] + ['_____'] + words[chosen_idx+1:])
        
        # Generate wrong options from other terms in document
        wrong_options = []
        for term in terms:
            term_clean = re.sub(r'[^a-zA-Z]', '', term)
            if term_clean.lower() != chosen_word.lower() and len(term_clean) >= 3:
                wrong_options.append(term)
            if len(wrong_options) >= 6:
                break
        
        # Add some generic wrong options if needed
        generic_wrong = ["process", "system", "method", "structure", "element", "component", "function", "pattern"]
        for g in generic_wrong:
            if g.lower() != chosen_word.lower() and len(wrong_options) < 6:
                wrong_options.append(g.title())
        
        random.shuffle(wrong_options)
        wrong_options = wrong_options[:3]
        
        options = [chosen_word] + wrong_options
        random.shuffle(options)
        correct_idx = options.index(chosen_word)
        
        return {
            "id": idx,
            "question": f"Complete the sentence: \"{blank_sentence}\"",
            "options": options,
            "correct_answer": correct_idx,
            "explanation": f"The complete sentence is: \"{sentence}\""
        }
    
    # Strategy 2: Concept understanding questions
    def make_concept_question(concept: Dict, idx: int) -> Dict:
        """Create a question testing understanding of a concept."""
        term = concept['term']
        definition = concept['definition']
        full = concept['full_sentence']
        
        question_styles = [
            f"What best describes '{term}' according to the material?",
            f"Based on the study material, what is '{term}'?",
            f"Which statement correctly explains '{term}'?",
            f"How is '{term}' described in this material?",
        ]
        
        question_text = random.choice(question_styles)
        correct_option = definition[:120] if len(definition) > 120 else definition
        
        # Generate plausible wrong answers from other concepts/sentences
        wrong_options = []
        for other in concepts:
            if other['term'] != term and len(wrong_options) < 5:
                wrong_def = other['definition'][:120]
                wrong_options.append(wrong_def)
        
        # Add wrong options from unrelated sentences
        for s in sentences:
            if term.lower() not in s.lower() and len(wrong_options) < 5:
                short_s = s[:120] if len(s) > 120 else s
                wrong_options.append(short_s)
        
        random.shuffle(wrong_options)
        wrong_options = wrong_options[:3]
        
        options = [correct_option] + wrong_options
        random.shuffle(options)
        correct_idx = options.index(correct_option)
        
        return {
            "id": idx,
            "question": question_text,
            "options": options,
            "correct_answer": correct_idx,
            "explanation": f"{full}"
        }
    
    # Strategy 3: True/False style (which statement is correct)
    def make_true_false_question(fact: str, idx: int) -> Dict:
        """Create a 'which is correct' question from a fact."""
        # The fact is the correct answer
        correct_option = fact[:140] if len(fact) > 140 else fact
        
        # Generate wrong statements by modifying the fact
        wrong_options = []
        
        # Negate the fact
        negated = fact.replace(' is ', ' is not ').replace(' are ', ' are not ').replace(' can ', ' cannot ')
        if negated != fact:
            wrong_options.append(negated[:140])
        
        # Use unrelated sentences as wrong options
        for s in sentences:
            if s != fact and len(wrong_options) < 4:
                # Modify to make it wrong
                modified = s.replace(' is ', ' is never ').replace(' are ', ' are rarely ')
                if modified != s:
                    wrong_options.append(modified[:140])
        
        # Fill with clearly wrong statements
        if len(wrong_options) < 3:
            filler = [
                f"This topic has no practical applications",
                f"The material contradicts established research",
                f"None of the concepts in the material are related",
            ]
            wrong_options.extend(filler)
        
        random.shuffle(wrong_options)
        wrong_options = wrong_options[:3]
        
        options = [correct_option] + wrong_options
        random.shuffle(options)
        correct_idx = options.index(correct_option)
        
        return {
            "id": idx,
            "question": "Which of the following statements from the material is correct?",
            "options": options,
            "correct_answer": correct_idx,
            "explanation": f"The correct statement is directly from the study material: \"{fact}\""
        }
    
    # Strategy 4: Relationship questions
    def make_relationship_question(idx: int) -> Dict:
        """Ask about relationships between concepts."""
        if len(terms) < 3:
            return None
        
        # Find two related terms (appear in same sentence)
        pairs = []
        for sentence in sentences:
            sent_lower = sentence.lower()
            found_terms = [t for t in terms if t.lower() in sent_lower]
            if len(found_terms) >= 2:
                pairs.append((found_terms[0], found_terms[1], sentence))
        
        if not pairs:
            return None
        
        term1, term2, context = random.choice(pairs)
        
        correct_option = context[:140] if len(context) > 140 else context
        
        wrong_options = [
            f"{term1} and {term2} are completely unrelated concepts",
            f"{term1} replaces {term2} in all cases",
            f"{term2} is the opposite of {term1}",
        ]
        
        options = [correct_option] + wrong_options
        random.shuffle(options)
        correct_idx = options.index(correct_option)
        
        return {
            "id": idx,
            "question": f"What is the relationship between '{term1}' and '{term2}' according to the material?",
            "options": options,
            "correct_answer": correct_idx,
            "explanation": f"According to the material: \"{context}\""
        }
    
    # Generate questions using all strategies
    question_id = 1
    strategies = []
    
    # Add concept questions
    for concept in concepts[:num_questions]:
        strategies.append(('concept', concept))
    
    # Add fill-in-blank from facts
    for fact in facts[:num_questions]:
        strategies.append(('blank', fact))
    
    # Add true/false from facts
    for fact in facts[:num_questions]:
        strategies.append(('truefalse', fact))
    
    # Add relationship questions
    for _ in range(min(3, num_questions)):
        strategies.append(('relationship', None))
    
    random.shuffle(strategies)
    
    for strategy_type, data in strategies:
        if len(questions) >= num_questions:
            break
        
        q = None
        if strategy_type == 'concept' and data:
            q = make_concept_question(data, question_id)
        elif strategy_type == 'blank' and data and data not in used_sentences:
            q = make_fill_blank_question(data, question_id)
            used_sentences.add(data)
        elif strategy_type == 'truefalse' and data and data not in used_sentences:
            q = make_true_false_question(data, question_id)
            used_sentences.add(data)
        elif strategy_type == 'relationship':
            q = make_relationship_question(question_id)
        
        if q and len(q['options']) == 4:
            questions.append(q)
            question_id += 1
    
    # If still not enough questions, create from remaining sentences
    while len(questions) < num_questions and sentences:
        remaining = [s for s in facts + sentences if s not in used_sentences]
        if not remaining:
            break
        sentence = remaining[0]
        used_sentences.add(sentence)
        q = make_fill_blank_question(sentence, question_id)
        if q and len(q['options']) == 4:
            questions.append(q)
            question_id += 1
    
    # Create title from key terms
    title_terms = terms[:3] if terms else ["Study Material"]
    title = f"Quiz: {', '.join(title_terms[:2])}"
    
    return {"title": title, "questions": questions}


# ═══════════════════════════════════════════════════════════════════════════════
#  FLASHCARD GENERATION - Engaging cards from material
# ═══════════════════════════════════════════════════════════════════════════════

def generate_flashcards(document_id: int, text: str, num_cards: int) -> List[Dict]:
    """Generate engaging flashcards strictly from document content."""
    sentences = _split_sentences(text)
    concepts = _get_key_concepts(text)
    facts = _find_facts(text)
    terms = _get_important_terms(text)
    
    cards = []
    used = set()
    
    # Card type 1: Concept definition cards
    for concept in concepts:
        if len(cards) >= num_cards:
            break
        term = concept['term']
        full_sentence = concept['full_sentence']
        if term in used:
            continue
        used.add(term)
        
        front_styles = [
            f"What is {term}?",
            f"Define: {term}",
            f"Explain '{term}' in your own words.",
        ]
        
        cards.append({
            "front": random.choice(front_styles),
            "back": full_sentence,
            "difficulty": "easy" if len(full_sentence.split()) < 20 else "medium",
        })
    
    # Card type 2: Fact recall cards
    for fact in facts:
        if len(cards) >= num_cards:
            break
        if fact in used:
            continue
        used.add(fact)
        
        # Ask a question based on the fact
        words = fact.split()
        if len(words) > 8:
            # Find a key word to ask about
            important_words = [w for w in words if len(w) > 5 and w[0].isupper()]
            if important_words:
                keyword = important_words[0]
                cards.append({
                    "front": f"What does the material say about {keyword}?",
                    "back": fact,
                    "difficulty": "medium",
                })
            else:
                cards.append({
                    "front": f"True or False: {fact}",
                    "back": f"TRUE - {fact}",
                    "difficulty": "easy",
                })
    
    # Card type 3: Key term cards
    for term in terms:
        if len(cards) >= num_cards:
            break
        if term in used:
            continue
        
        # Find a sentence mentioning this term
        related = [s for s in sentences if term.lower() in s.lower()]
        if related:
            used.add(term)
            cards.append({
                "front": f"What do you know about {term}? How is it used in this material?",
                "back": related[0],
                "difficulty": "medium" if len(related[0].split()) < 20 else "hard",
            })
    
    # Card type 4: Application/thinking cards
    if len(cards) < num_cards and len(sentences) > 3:
        thinking_prompts = [
            "Why is this concept important?",
            "How would you explain this to someone else?",
            "What are the practical applications?",
            "How does this connect to other concepts in the material?",
        ]
        
        for i, sentence in enumerate(sentences):
            if len(cards) >= num_cards:
                break
            if sentence in used:
                continue
            used.add(sentence)
            prompt = thinking_prompts[i % len(thinking_prompts)]
            cards.append({
                "front": f"{prompt}\n\nContext: \"{sentence[:80]}...\"",
                "back": sentence,
                "difficulty": "hard",
            })
    
    return cards if cards else [{
        "front": "What is the main topic of this document?",
        "back": sentences[0] if sentences else "Review the uploaded material.",
        "difficulty": "easy"
    }]


# ═══════════════════════════════════════════════════════════════════════════════
#  CHAT - Intelligent document Q&A
# ═══════════════════════════════════════════════════════════════════════════════

def chat_with_document(document_id: int, message: str, chat_history: List[Dict] = None) -> str:
    """Chat about a document - not used directly, see chat_with_document_and_text."""
    return "Please provide the document text for me to help you."


def chat_with_document_and_text(document_id: int, message: str, text: str, chat_history: List[Dict] = None) -> str:
    """Intelligent chat response based on document content."""
    sentences = _split_sentences(text)
    concepts = _get_key_concepts(text)
    terms = _get_important_terms(text)
    message_lower = message.lower()
    
    # Find relevant sentences
    relevant = _find_related_sentences(message, sentences, top_k=6)
    
    # Detect question type
    is_what = any(w in message_lower for w in ['what', 'define', 'explain', 'describe'])
    is_how = any(w in message_lower for w in ['how', 'process', 'steps', 'method'])
    is_why = any(w in message_lower for w in ['why', 'reason', 'because', 'purpose'])
    is_list = any(w in message_lower for w in ['list', 'types', 'examples', 'kinds', 'categories'])
    is_compare = any(w in message_lower for w in ['compare', 'difference', 'versus', 'vs', 'between'])
    is_summary = any(w in message_lower for w in ['summary', 'summarize', 'overview', 'brief'])
    
    response = ""
    
    if is_summary:
        response = "## Summary of the Material\n\n"
        key_facts = _find_facts(text)[:8]
        if key_facts:
            response += "Here are the key points:\n\n"
            for i, fact in enumerate(key_facts, 1):
                response += f"**{i}.** {fact}\n\n"
        if terms:
            response += f"\n**Key Terms:** {', '.join(terms[:10])}\n"
    
    elif is_list and relevant:
        response = f"## Here's what the material covers:\n\n"
        for i, point in enumerate(relevant, 1):
            response += f"**{i}.** {point}\n\n"
    
    elif is_compare:
        response = f"## Comparison based on the material:\n\n"
        if relevant:
            for point in relevant:
                response += f"- {point}\n\n"
        else:
            response += "I couldn't find a direct comparison in the material. "
            response += "Here are related points:\n\n"
            for s in sentences[:5]:
                response += f"- {s}\n\n"
    
    elif relevant:
        if is_what:
            response = "## Here's what the material says:\n\n"
        elif is_how:
            response = "## Here's how it works according to the material:\n\n"
        elif is_why:
            response = "## Here's what the material explains:\n\n"
        else:
            response = "## Based on your study material:\n\n"
        
        for i, point in enumerate(relevant, 1):
            response += f"**Point {i}:** {point}\n\n"
        
        # Add related concepts if available
        related_concepts = [c for c in concepts if any(
            w in c['term'].lower() for w in re.findall(r'\b[a-z]{4,}\b', message_lower)
        )]
        if related_concepts:
            response += "\n**Related concepts:**\n"
            for c in related_concepts[:3]:
                response += f"- **{c['term']}**: {c['definition']}\n"
    
    else:
        # No direct match - provide general info
        response = "## From the study material:\n\n"
        response += "I didn't find an exact match for your question, but here are key points from the material:\n\n"
        for s in sentences[:5]:
            response += f"- {s}\n\n"
        if terms:
            response += f"\n**Topics covered:** {', '.join(terms[:8])}\n"
        response += "\nTry asking about one of these specific topics!"
    
    return response


# ═══════════════════════════════════════════════════════════════════════════════
#  MATH SOLVER - Pure Python
# ═══════════════════════════════════════════════════════════════════════════════

def solve_math(problem: str) -> str:
    """Solve math problems with step-by-step explanation using pure Python."""
    response = f"## Solution: {problem}\n\n"
    
    # Try to evaluate arithmetic expressions
    arithmetic_match = re.search(r'^[\d\s+\-*/().^%]+$', problem.strip())
    if arithmetic_match:
        try:
            expr = problem.replace('^', '**').replace('x', '*')
            result = eval(expr)
            response += f"**Expression:** `{problem}`\n\n"
            response += f"**Step 1:** Evaluate using order of operations (PEMDAS)\n\n"
            response += f"**Step 2:** Calculate\n\n"
            response += f"### Answer: **{result}**\n"
            return response
        except:
            pass
    
    # Try to parse and solve equations
    equation_match = re.search(r'(.+?)\s*=\s*(.+)', problem)
    if equation_match or 'solve' in problem.lower():
        response += "### Solving the equation:\n\n"
        response += f"**Given:** {problem}\n\n"
        
        # Try simple linear equations: ax + b = c
        linear_match = re.search(r'(\d*)\s*x\s*([+-]\s*\d+)\s*=\s*(\d+)', problem)
        if linear_match:
            a = int(linear_match.group(1)) if linear_match.group(1) else 1
            b = int(linear_match.group(2).replace(' ', ''))
            c = int(linear_match.group(3))
            x = (c - b) / a
            response += f"**Step 1:** {a}x + {b} = {c}\n\n"
            response += f"**Step 2:** {a}x = {c} - ({b}) = {c - b}\n\n"
            response += f"**Step 3:** x = {c - b} / {a}\n\n"
            response += f"### Answer: **x = {x}**\n"
            return response
        
        # Quadratic: ax^2 + bx + c = 0
        quad_match = re.search(r'(\d*)\s*x\^?2\s*([+-]\s*\d*)\s*x\s*([+-]\s*\d+)\s*=\s*0', problem)
        if quad_match:
            a = int(quad_match.group(1)) if quad_match.group(1) else 1
            b = int(quad_match.group(2).replace(' ', '')) if quad_match.group(2).replace(' ', '').replace('+','').replace('-','') else 0
            c = int(quad_match.group(3).replace(' ', ''))
            
            discriminant = b**2 - 4*a*c
            response += f"**Step 1:** Identify a={a}, b={b}, c={c}\n\n"
            response += f"**Step 2:** Discriminant = b² - 4ac = {b}² - 4({a})({c}) = {discriminant}\n\n"
            
            if discriminant >= 0:
                x1 = (-b + math.sqrt(discriminant)) / (2*a)
                x2 = (-b - math.sqrt(discriminant)) / (2*a)
                response += f"**Step 3:** x = (-b ± √discriminant) / 2a\n\n"
                response += f"### Answer: **x₁ = {x1:.2f}, x₂ = {x2:.2f}**\n"
            else:
                response += f"**Step 3:** Discriminant is negative → Complex roots\n\n"
                real_part = -b / (2*a)
                imag_part = math.sqrt(-discriminant) / (2*a)
                response += f"### Answer: **x = {real_part:.2f} ± {imag_part:.2f}i**\n"
            return response
        
        response += "**Method:**\n"
        response += "1. Isolate the variable on one side\n"
        response += "2. Simplify both sides\n"
        response += "3. Solve for the unknown\n\n"
        response += "*For quadratic equations, use: x = (-b ± √(b²-4ac)) / 2a*\n"
        return response
    
    # Derivative
    if 'derivative' in problem.lower() or 'differentiat' in problem.lower():
        response += "### Differentiation:\n\n"
        response += "**Rules applied:**\n"
        response += "- Power Rule: d/dx(xⁿ) = nxⁿ⁻¹\n"
        response += "- Sum Rule: d/dx(f+g) = f' + g'\n"
        response += "- Product Rule: d/dx(fg) = f'g + fg'\n"
        response += "- Chain Rule: d/dx(f(g(x))) = f'(g(x))·g'(x)\n\n"
        
        # Try to parse polynomial
        poly_terms = re.findall(r'([+-]?\s*\d*)\s*x\^?(\d*)', problem)
        if poly_terms:
            response += "**Solution:**\n\n"
            derivative_terms = []
            for coeff_str, exp_str in poly_terms:
                coeff = int(coeff_str.replace(' ', '')) if coeff_str.replace(' ', '').replace('+','').replace('-','') else 1
                exp = int(exp_str) if exp_str else 1
                if exp > 0:
                    new_coeff = coeff * exp
                    new_exp = exp - 1
                    if new_exp == 0:
                        derivative_terms.append(f"{new_coeff}")
                    elif new_exp == 1:
                        derivative_terms.append(f"{new_coeff}x")
                    else:
                        derivative_terms.append(f"{new_coeff}x^{new_exp}")
            if derivative_terms:
                response += f"### Answer: **f'(x) = {' + '.join(derivative_terms)}**\n"
                return response
        
        response += "Apply the appropriate rule based on the function type.\n"
        return response
    
    # Percentage
    if 'percent' in problem.lower() or '%' in problem:
        nums = re.findall(r'[\d.]+', problem)
        if len(nums) >= 2:
            a, b = float(nums[0]), float(nums[1])
            if 'of' in problem.lower():
                result = a/100 * b
                response += f"**Step 1:** {a}% of {b}\n\n"
                response += f"**Step 2:** ({a}/100) × {b} = {result}\n\n"
                response += f"### Answer: **{result}**\n"
                return response
    
    # General arithmetic with explanation
    try:
        # Clean expression for eval
        expr = problem.strip()
        expr = re.sub(r'[^0-9+\-*/().^% ]', '', expr)
        expr = expr.replace('^', '**')
        if expr and len(expr) < 100:
            result = eval(expr)
            response += f"**Calculation:** {problem}\n\n"
            response += f"### Answer: **{result}**\n"
            return response
    except:
        pass
    
    # If can't solve directly, provide approach
    response += "### Approach:\n\n"
    response += f"**Problem:** {problem}\n\n"
    response += "**Steps:**\n"
    response += "1. Identify what is being asked\n"
    response += "2. Write down known values\n"
    response += "3. Choose the appropriate formula\n"
    response += "4. Substitute and calculate\n"
    response += "5. Verify your answer\n"
    
    return response


# ═══════════════════════════════════════════════════════════════════════════════
#  TASK GENERATION - Study tasks from material
# ═══════════════════════════════════════════════════════════════════════════════

def generate_tasks(document_id: int, text: str, num_tasks: int) -> List[Dict]:
    """Generate meaningful study tasks based on document content."""
    sentences = _split_sentences(text)
    concepts = _get_key_concepts(text)
    terms = _get_important_terms(text)
    paragraphs = _extract_paragraphs(text)
    
    tasks = []
    
    # Reading & Understanding
    tasks.append({
        "title": "Active Reading",
        "description": f"Read the material carefully. Identify and highlight these key concepts: {', '.join(terms[:5])}. Write a one-sentence summary for each.",
        "task_type": "reading",
        "difficulty": "easy",
        "estimated_minutes": 15,
    })
    
    # Vocabulary/Terms
    if terms:
        tasks.append({
            "title": "Master Key Terminology",
            "description": f"Create your own definitions for these terms: {', '.join(terms[:8])}. Then compare with the material to check accuracy.",
            "task_type": "practice",
            "difficulty": "easy",
            "estimated_minutes": 20,
        })
    
    # Summarization
    tasks.append({
        "title": "Write a Summary",
        "description": f"Summarize the material in your own words (max 200 words). Cover: the main topic, {len(terms)} key concepts, and how they relate to each other.",
        "task_type": "summary",
        "difficulty": "medium",
        "estimated_minutes": 25,
    })
    
    # Concept mapping
    if len(terms) >= 4:
        tasks.append({
            "title": "Create a Concept Map",
            "description": f"Draw a concept map connecting: {', '.join(terms[:6])}. Show how each concept relates to others using arrows and labels.",
            "task_type": "creative",
            "difficulty": "medium",
            "estimated_minutes": 30,
        })
    
    # Self-testing
    if concepts:
        concept_names = [c['term'] for c in concepts[:5]]
        tasks.append({
            "title": "Self-Test: Recall Challenge",
            "description": f"Close the material. Write everything you remember about: {', '.join(concept_names)}. Then check what you missed.",
            "task_type": "practice",
            "difficulty": "medium",
            "estimated_minutes": 20,
        })
    
    # Teach-back
    tasks.append({
        "title": "Teach It to Someone",
        "description": "Explain the main ideas from this material as if teaching a friend who knows nothing about the topic. Use simple language and examples.",
        "task_type": "discussion",
        "difficulty": "hard",
        "estimated_minutes": 25,
    })
    
    # Application
    tasks.append({
        "title": "Real-World Application",
        "description": f"Think of 3 real-world examples or applications of the concepts in this material. Write a short paragraph for each explaining the connection.",
        "task_type": "creative",
        "difficulty": "hard",
        "estimated_minutes": 30,
    })
    
    # Practice questions
    tasks.append({
        "title": "Create Your Own Questions",
        "description": f"Write 5 questions that could be on an exam about this material. Include 2 easy, 2 medium, and 1 hard question. Then answer them.",
        "task_type": "practice",
        "difficulty": "hard",
        "estimated_minutes": 35,
    })
    
    # Deep dive
    if terms:
        tasks.append({
            "title": "Deep Dive Research",
            "description": f"Choose one concept ({terms[0]}) and research it further. Find 2 additional facts not mentioned in the material.",
            "task_type": "research",
            "difficulty": "medium",
            "estimated_minutes": 30,
        })
    
    # Review
    tasks.append({
        "title": "Spaced Review",
        "description": "Review your notes and flashcards from this material. Mark any concepts you're still unsure about and re-read those sections.",
        "task_type": "reading",
        "difficulty": "easy",
        "estimated_minutes": 10,
    })
    
    return tasks[:num_tasks]


# ═══════════════════════════════════════════════════════════════════════════════
#  TOPIC QUESTION - General knowledge response
# ═══════════════════════════════════════════════════════════════════════════════

def answer_topic_question(topic: str, question: str) -> str:
    """Answer a general topic question using logical reasoning."""
    response = f"## {topic}\n\n"
    response += f"**Your Question:** {question}\n\n"
    response += "---\n\n"
    response += "### Here's what to consider:\n\n"
    response += f"When thinking about {topic}, consider these aspects:\n\n"
    response += f"1. **Definition:** What exactly is {topic}? Break it down into its core components.\n\n"
    response += f"2. **Key Principles:** What are the fundamental rules or ideas that govern {topic}?\n\n"
    response += f"3. **Applications:** Where and how is {topic} used in practice?\n\n"
    response += f"4. **Connections:** How does {topic} relate to other subjects you're studying?\n\n"
    response += "### Study Tip:\n\n"
    response += f"To deeply understand {topic}, try explaining it in your own words, "
    response += "create examples, and look for patterns. Upload your study material "
    response += "about this topic and I can give you more specific answers!\n"
    
    return response


# ═══════════════════════════════════════════════════════════════════════════════
#  LEGACY COMPATIBILITY
# ═══════════════════════════════════════════════════════════════════════════════

def is_api_key_configured() -> bool:
    """Always returns True - no API key needed."""
    return True
