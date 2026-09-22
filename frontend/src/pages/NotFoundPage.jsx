import { Link } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";

export function NotFoundPage() {
  return (
    <EmptyState
      title="페이지를 찾을 수 없습니다"
      description="주소가 잘못되었거나 삭제된 페이지입니다."
      action={
        <Link to="/" style={{ color: "var(--color-link)", fontWeight: 600 }}>
          홈으로 돌아가기
        </Link>
      }
    />
  );
}
