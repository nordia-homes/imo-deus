
export function Footer() {
    return (
        <footer className="border-t">
            <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                        &copy; {new Date().getFullYear()} Dream Homes Real Estate. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
