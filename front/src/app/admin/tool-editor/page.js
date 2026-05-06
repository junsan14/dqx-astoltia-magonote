import Link from 'next/link'

export default function ToolsPage() {
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-10 px-4 transition-colors">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                    Tools Dashboard
                </h1>

                <ul className="space-y-3">
                    {[
                        { href: "/tool-editor/equipments", label: "装備管理" },
                        { href: "/tool-editor/orbs", label: "オーブ管理" },
                        { href: "/tool-editor/items", label: "アイテム管理" },
                        { href: "/tool-editor/accessories", label: "アクセサリー管理" },
                        { href: "/tool-editor/monsters", label: "モンスター管理" },
                    ].map((item) => (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className="
                                    block p-4 rounded-lg
                                    bg-white dark:bg-gray-800
                                    border border-gray-200 dark:border-gray-700
                                    text-gray-900 dark:text-gray-100
                                    hover:bg-gray-50 dark:hover:bg-gray-700
                                    transition
                                "
                            >
                                {item.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}