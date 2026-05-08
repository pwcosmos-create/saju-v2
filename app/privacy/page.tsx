export const metadata = { title: '개인정보처리방침 | ✦ AI사주' };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'Pretendard, sans-serif', lineHeight: 1.8, color: '#222' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>개인정보처리방침</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>시행일: 2026년 4월 26일</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>1. 수집하는 개인정보</h2>
        <p>서비스는 사주 분석을 위해 다음 정보를 입력받습니다.</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>생년월일 및 태어난 시간</li>
          <li>성별</li>
        </ul>
        <p style={{ marginTop: 8 }}>기본적인 사주 분석 결과는 서버에 저장되지 않고 실시간으로만 계산됩니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>2. 피드백 데이터의 수집 및 이용</h2>
        <p>사용자가 자발적으로 피드백(도움됐어요/별로예요 등)을 제출하는 경우에 한해, AI 모델의 답변 품질 개선을 목적으로 다음 정보가 익명화되어 수집 및 저장될 수 있습니다.</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>사주 명식(생년월일 기반) 및 AI 응답 결과</li>
          <li>선택한 별점 및 작성된 코멘트</li>
        </ul>
        <p style={{ marginTop: 8, color: '#e05555' }}>코멘트 입력 시 본인의 이름이나 연락처 등 개인을 특정할 수 있는 정보는 절대 입력하지 마시기 바랍니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>3. 개인정보의 보유 및 파기</h2>
        <p>사주 분석 자체를 위한 입력 정보는 즉시 파기됩니다. 다만 서비스 개선용 피드백 데이터는 개인 식별이 불가능한 형태로 서버 로그 파일에 저장될 수 있으며, 배포 환경 특성(재배포/인프라 교체)에 따라 보관 기간이 달라질 수 있습니다. 운영자는 목적 달성 후 지체 없이 파기합니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>4. 제3자 서비스 이용</h2>
        <p>AI 풀이 생성을 위해 Google의 Gemini AI API를 사용합니다. 분석 요청 시 입력 내용이 Google 서버로 전송될 수 있으며, Google의 개인정보처리방침이 적용됩니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>5. 이용자의 권리</h2>
        <p>이용자는 언제든지 개인정보 처리에 대한 문의 및 열람·삭제 요청을 할 수 있습니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>6. 개인정보 보호 책임자</h2>
        <p>이메일: pwcosmos@gmail.com</p>
      </section>
    </main>
  );
}
