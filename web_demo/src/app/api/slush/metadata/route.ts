export async function GET() {
  return Response.json(
    {
      id: "com.mystenlabs.suiwallet.web",
      walletName: "Slush",
      icon: "",
      enabled: true,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
