export const metadata = { title: '이용약관 | AI사주' };

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'Pretendard, sans-serif', lineHeight: 1.8, color: '#222' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>이용약관</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>시행일: 2026년 4월 26일</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>제1조 (목적)</h2>
        <p>본 약관은 AI사주(이하 "서비스")가 제공하는 사주팔자 분석 서비스의 이용 조건 및 절차, 이용자와 서비스 간의 권리·의무 등을 규정함을 목적으로 합니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>제2조 (서비스 내용)</h2>
        <p>서비스는 이용자가 입력한 생년월일·성별 정보를 바탕으로 사주팔자 분석 및 AI 풀이를 제공합니다. 서비스는 참고 목적의 정보 제공이며, 의료·법률·재정 등의 전문적 판단을 대체하지 않습니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>제3조 (이용자의 의무)</h2>
        <p>이용자는 서비스를 법령 및 본 약관에 따라 이용하여야 하며, 타인의 권리를 침해하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>제4조 (서비스 변경 및 중단)</h2>
        <p>서비스는 운영상·기술상 필요에 의해 사전 고지 없이 서비스 내용을 변경하거나 중단할 수 있습니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>제5조 (면책)</h2>
        <p>서비스가 제공하는 사주 분석 결과는 동양 철학에 기반한 참고 정보이며, 결과의 정확성·완전성을 보장하지 않습니다. 이를 신뢰하여 발생한 손해에 대해 서비스는 책임을 지지 않습니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>제6조 (문의)</h2>
        <p>이용약관에 관한 문의는 pwcosmos@gmail.com으로 연락해 주세요.</p>
      </section>
    </main>
  );
}
