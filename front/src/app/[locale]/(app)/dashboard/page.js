export const metadata = {
    title: 'Laravel - Dashboard',
}

const Dashboard = () => {
    return (
        <>
            <div className="py-12 bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="overflow-hidden shadow-sm sm:rounded-lg bg-white dark:bg-gray-800">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                            You are logged in!
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Dashboard