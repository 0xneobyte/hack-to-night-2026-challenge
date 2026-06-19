import Sidebar from '@/components/sidebar'

export default function SmartSpendPage() {
  return (
    <div className="min-h-screen bg-bg-light font-geist p-0">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-12 text-black">
          <h2 className="text-2xl font-semibold mb-6">Smart Spend</h2>
          <div className="rounded-[32px] bg-white px-10 py-8 shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)]">
            <p className="text-gray-500">
              Coming soon. Spending analytics and budget tracking will appear
              here.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
