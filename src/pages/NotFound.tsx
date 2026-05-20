import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Stethoscope } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    document.title = "404 — Page Not Found | Shifora";
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);

    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const looksLikeAuth =
      hash.includes('access_token=') ||
      search.includes('code=');
    if (looksLikeAuth) {
      navigate(`/${search}${hash}`, { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Stethoscope className="h-10 w-10 text-primary" />
        </div>
        <h1
          className="text-7xl sm:text-8xl font-semibold tracking-tight text-foreground"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          404
        </h1>
        <h2
          className="mt-4 text-2xl font-medium text-foreground"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {t('notFound.title')}
        </h2>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          {t('notFound.desc')}
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70 font-mono break-all">
          {location.pathname}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" /> {t('common.goHome')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> {t('common.goBack')}
          </Button>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Shifora · Dr. Mabari
        </p>
      </div>
    </div>
  );
};

export default NotFound;
