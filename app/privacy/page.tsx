export const metadata = { title: '개인정보처리방침 | AI사주' };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'Pretendard, sans-serif', lineHeight: 1.8, color: '#222' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>개인정보처리방침</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>시행일: 2026년 4월 26일</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>1. 수집하는 개인정보</h2>
        <p>서비스는 사주 분석을 위해 다음 정보를 수집합니다.</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>생년월일 및 태어난 시간</li>
          <li>성별</li>
        </ul>
        <p style={{ marginTop: 8 }}>위 정보는 이용자가 직접 입력하며, 서버에 저장되지 않습니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>2. 개인정보의 이용 목적</h2>
        <p>수집된 정보는 사주팔자 계산 및 AI 풀이 생성에만 사용되며, 마케팅·광고 등 다른 목적으로 사용하지 않습니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>3. 개인정보의 보유 및 파기</h2>
        <p>입력된 정보는 분석 결과 제공 후 즉시 파기되며, 별도로 저장하거나 제3자에게 제공하지 않습니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>4. 제3자 서비스 이용</h2>
        <p>AI 풀이 생성을 위해 Groq Inc.의 AI API를 사용합니다. 분석 요청 시 입력 내용이 Groq 서버로 전송될 수 있으며, Groq의 개인정보처리방침이 적용됩니다.</p>
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
