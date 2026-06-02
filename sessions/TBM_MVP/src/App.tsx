// App.tsx: 메인 레이아웃 및 상태 통합 (최종 검증)
import React, { useState } from 'react';
import TrustBarModule from './components/TrustBarModule';
import { useApi } from './hooks/useApi';

const App: React.FC = () => {
  // 초기 상태 설정 (Designer의 요구사항 기반)
  const [initialStatus, setInitialStatus] = useState<'DeepCopper' | 'ClearSkyBlue'>('ClearSkyBlue');

  // API 데이터 훅 사용
  const { data, loading, error } = useApi();

  // 데이터 흐름을 TBM에 전달하기 위한 준비 (데이터 바인딩)
  const tbmDataStream = data;

  if (loading) {
    return <div>⏳ Trust Bar Module 로딩 중...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>🚨 에러 발생: {error}</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Systemic Control Dashboard</h1>
      <h2>Trust Bar Module MVP</h2>
      
      {/* Trust Bar Module 구현 */}
      <TrustBarModule 
        initialState={initialStatus} 
        dataStream={tbmDataStream} 
      />

      <p style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
        Systemic Control Layer Ready. 안정화된 데이터 바인딩 완료. ✅
      </p>
    </div>
  );
};

export default App;