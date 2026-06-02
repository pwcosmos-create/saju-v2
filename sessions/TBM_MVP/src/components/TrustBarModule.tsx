// TrustBarModule.tsx: TBM의 메인 컴포넌트 파일
import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi'; // API 호출을 위한 훅 (가정)

// 타입 정의 (Designer의 스펙 기반 가정)
type DPSRState = 'DeepCopper' | 'ClearSkyBlue';
type TrustBarData = {
  status: DPSRState;
  message: string;
  value: number;
};

interface TrustBarProps {
  initialState: DPSRState;
  dataStream: any; // 실시간 데이터 스트림 (API에서 받을 예정)
}

const TrustBarModule: React.FC<TrustBarProps> = ({ initialState, dataStream }) => {
  const [tbmData, setTbmData] = useState<TrustBarData>({
    status: initialState,
    message: '데이터 로딩 중...',
    value: 0,
  });

  // 데이터 스트림을 받아 상태를 업데이트하는 로직 (핵심 State Logic)
  useEffect(() => {
    if (dataStream) {
      setTbmData(prevData => ({ ...prevData, ...dataStream }));
    }
  }, [dataStream]);

  // API 연동 및 데이터 바인딩 로직 (useApi 훅을 통해 실제 데이터 처리 예정)
  const handleDataUpdate = useCallback((newData: any) => {
    // 데이터 안정성 검증 및 상태 업데이트 로직 구현
    console.log('Received data:', newData);
    setTbmData(prevData => ({
      ...prevData,
      value: newData.revenue || 0, // 예시: 수입 값 바인딩
      message: newData.status === 'DeepCopper' ? '경고 상태: 데이터 안정성 확보 필요' : '안정 상태: 시스템 통제권 확보',
    }));
  }, []);

  return (
    <div style={{ 
        border: `2px solid ${tbmData.status === 'DeepCopper' ? '#ff0000' : '#00bfff'}`, // Deep Copper/Clear Sky Blue 적용 시각화
        padding: '15px',
        borderRadius: '8px',
        backgroundColor: tbmData.status === 'DeepCopper' ? '#3a2a2a' : '#e0f7fa',
        color: tbmData.status === 'DeepCopper' ? '#ff6666' : '#0056b3',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: 'monospace'
    }}>
      <div>
        <strong>DPSR Status: {tbmData.status}</strong>
        <p>{tbmData.message}</p>
      </div>
      <div>
        <strong>Revenue: ${tbmData.value.toFixed(2)}</strong>
      </div>
    </div>
  );
};

export default TrustBarModule;