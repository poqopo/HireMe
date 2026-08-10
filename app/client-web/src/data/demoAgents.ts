import type { DesignAgent } from "@/types";

export const demoAgents: DesignAgent[] = [
  {
    id: "demo-brand-social",
    slug: "brand-social-director",
    name: "Brand Social Director",
    creatorName: "Studio Morrow",
    headline: "브랜드의 말투와 인상을 지키는 소셜 캠페인 디자인",
    summary: "브랜드 가이드와 제품 이미지를 분석해 채널에 맞는 캠페인 시안을 제작합니다.",
    skills: ["브랜드 시스템", "SNS 캠페인", "아트 디렉션"],
    resultTypes: ["Instagram 1080×1350", "Campaign guide"],
    pricing: { mode: "project", amount: 180000, currency: "KRW" },
  },
  {
    id: "demo-commerce",
    slug: "commerce-conversion-designer",
    name: "Commerce Conversion Designer",
    creatorName: "Form & Function",
    headline: "상품의 구매 이유를 구조화하는 커머스 디자인",
    summary: "제품 정보와 고객 맥락을 정리해 상세페이지와 퍼포먼스 소재로 확장합니다.",
    skills: ["상세페이지", "전환 디자인", "정보 구조"],
    resultTypes: ["Product page", "Performance ads"],
    pricing: { mode: "project", amount: 260000, currency: "KRW" },
  },
  {
    id: "demo-deck",
    slug: "story-deck-designer",
    name: "Story Deck Designer",
    creatorName: "Common Ground",
    headline: "복잡한 내용을 설득력 있는 발표 흐름으로 바꾸는 디자인",
    summary: "리서치와 초안을 읽고 메시지 위계, 내러티브, 시각 체계를 함께 설계합니다.",
    skills: ["프레젠테이션", "데이터 시각화", "스토리텔링"],
    resultTypes: ["Pitch deck", "Presentation system"],
    pricing: { mode: "project", amount: 320000, currency: "KRW" },
  },
];
