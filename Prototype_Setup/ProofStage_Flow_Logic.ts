// ⚙️ ProofStage Flow Logic (State & Interaction Definition)

import { useState, useMemo } from 'react';

// --- 1. Data Structure Definitions based on Mockup Spec V2.0 ---
export interface KPISpec {
  ctr: number; // Click-Through Rate
  conversionTime: number; // Time taken for conversion (in seconds)
  roi_target: number; // Target ROI based on automation level
}

export interface FlowState {
  step: 'entry' | 'analysis' | 'decision' | 'result';
  inputData: KPISpec;
  feedback: string; // Dynamic feedback based on KPI checks
  isLoading: boolean;
}

const DPSR_mock = 0.99; // Mock Data Pipeline System Reliability

// --- 2. Core Logic Simulation Function (Simulates Data Flow & Feedback) ---
/**
 * Simulates the core logic flow for the Proof Stage interaction.
 * This function will be the basis for the prototype's state transitions and conditional rendering.
 */
export const runFlowSimulation = (initialData: KPISpec): FlowState => {
  let currentState: FlowState = {
    step: 'entry',
    inputData: initialData,
    feedback: '시스템 데이터를 로드 중입니다...',
    isLoading: true,
  };

  // Simulate Data Loading Delay (DPSR_mock check)
  setTimeout(() => {
    currentState.isLoading = false;

    // --- Step 1: Analysis based on Input Data ---
    let feedbackMessage = '';
    if (initialData.conversionTime >= 3 && initialData.ctr >= 0.7) {
      feedbackMessage = `성공 지표 확인: 전환 시간 (${initialData.conversionTime}s) 및 상호작용률 (${initialData.ctr * 100}%) 기준을 충족합니다. 다음 단계로 진행하세요.`;
    } else if (initialData.conversionTime < 3 || initialData.ctr < 0.7) {
      feedbackMessage = `주의: 핵심 KPI 중 일부 기준(체류 시간 또는 상호작용률)이 미달되었습니다. 데이터 안정성(${DPSR_mock * 100}%)을 확인하고 입력 데이터를 검토하세요.`;
    } else {
      feedbackMessage = '데이터 분석 완료. 다음 단계로 넘어가기 위해 최종 의사결정을 내리세요.';
    }

    // --- Step 2: Decision Point ---
    currentState.step = 'decision';
    currentState.feedback = feedbackMessage;

  }, 1500); // Simulate network/processing delay

  return currentState;
};