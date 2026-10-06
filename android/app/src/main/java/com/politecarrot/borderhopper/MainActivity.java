package com.politecarrot.borderhopper;

import android.os.Bundle;
import android.view.ActionMode;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Some WebViews (Samsung's One UI in particular) ignore CSS user-select and
 * still raise text selection and the copy menu on long-press, so it is
 * switched off here as well.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        webView.setLongClickable(false);
        webView.setHapticFeedbackEnabled(false);
        webView.setOnLongClickListener(v -> true);
        webView.setOnCreateContextMenuListener((menu, v, info) -> menu.clear());
    }

    // The floating copy/paste toolbar some WebView builds raise on double-tap.
    @Override
    public ActionMode onWindowStartingActionMode(ActionMode.Callback callback, int type) {
        if (type == ActionMode.TYPE_FLOATING) return null;
        return super.onWindowStartingActionMode(callback, type);
    }

    @Override
    public ActionMode onWindowStartingActionMode(ActionMode.Callback callback) {
        return null;
    }
}
