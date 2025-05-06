import React from 'react';

type ChatEntry = {
  type: string;
  text: string;
};

type ChatBotProps = {
  chatHistory: ChatEntry[];
  question: string;
  onQuestionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSendQuestion: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  loading: boolean;
};

const ChatBot: React.FC<ChatBotProps> = ({ chatHistory, question, onQuestionChange, onSendQuestion, onKeyDown, loading }) => {
  return (
    <div className='chat-container'>
      <div className='chat-window'>
        <div className='answer'><strong>어떤 등산 정보를 원하시나요?</strong><br /><small>예: 월악산 등산로 추천</small></div>
        {chatHistory.map((entry, i) => (
          <div key={i} className={entry.type} dangerouslySetInnerHTML={entry.type === 'answer' ? { __html: entry.text } : undefined}>
            {entry.type === 'question' ? entry.text : null}
          </div>
        ))}
      </div>
      <div className='chat-input'>
        <textarea value={question} onChange={onQuestionChange} onKeyDown={onKeyDown} placeholder="등산관련 질문 입력" />
        <button onClick={onSendQuestion} disabled={loading}>{loading ? '...' : '질문'}</button>
      </div>
    </div>
  );
};

export default ChatBot; 