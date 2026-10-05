'use strict';

const { Buffer } = require('buffer');

function decodeBase64Image(base64Data) {
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return null;
  const ext = matches[1];
  const b64 = matches[2];
  try {
    return { buffer: Buffer.from(b64, 'base64'), ext };
  } catch {
    return null;
  }
}

function tvFiles(cfg) {
  if (!cfg.tvEnabled) return {};

  const pkgPath = cfg.packageName.replace(/\./g, '/');
  const files = {};

  
  if (cfg.tvBannerBase64) {
    const decoded = decodeBase64Image(cfg.tvBannerBase64);
    if (decoded) {
      files[`android/app/src/main/res/drawable/tv_banner.${decoded.ext}`] = decoded.buffer;
    }
  }

  
  files['tv-build.gradle.patch'] = `
dependencies {
    implementation 'androidx.leanback:leanback:1.2.0-alpha01'
    implementation 'androidx.leanback:leanback-preference:1.2.0-alpha01'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.recyclerview:recyclerview:1.3.2'
    implementation 'com.google.android.material:material:1.11.0'
}`;

  
  files[`android/app/src/main/java/${pkgPath}/MainActivity.java`] = `package ${cfg.packageName};

import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.leanback.app.BrowseFragment;
import androidx.leanback.widget.ArrayObjectAdapter;
import androidx.leanback.widget.HeaderItem;
import androidx.leanback.widget.ListRow;
import androidx.leanback.widget.ListRowPresenter;
import androidx.leanback.widget.Presenter;
import androidx.leanback.widget.Row;
import androidx.leanback.widget.RowPresenter;

public class MainActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.tv_main_activity);
        
        if (savedInstanceState == null) {
            getSupportFragmentManager().beginTransaction()
                .replace(R.id.tv_main_fragment, new TVBrowseFragment())
                .commit();
        }
    }

    public static class TVBrowseFragment extends BrowseFragment {
        private static final int NUM_ROWS = 4;
        private static final int NUM_COLS = 6;

        @Override
        public void onActivityCreated(Bundle savedInstanceState) {
            super.onActivityCreated(savedInstanceState);
            
            setupUIElements();
            loadRows();
            setupEventListeners();
        }

        private void setupUIElements() {
            setTitle("${cfg.appName}");
            setHeadersState(HEADERS_ENABLED);
            setHeadersTransitionOnBackEnabled(true);
            setBrandColor(getResources().getColor(R.color.theme_color));
            setSearchAffordanceColor(getResources().getColor(R.color.colorAccent));
        }

        private void loadRows() {
            ArrayObjectAdapter rowsAdapter = new ArrayObjectAdapter(new ListRowPresenter());
            
            for (int i = 0; i < NUM_ROWS; i++) {
                ArrayObjectAdapter listRowAdapter = new ArrayObjectAdapter(new CardPresenter());
                HeaderItem header = new HeaderItem(i, "Row " + (i + 1));
                
                for (int j = 0; j < NUM_COLS; j++) {
                    listRowAdapter.add(new MovieItem("Item " + (j + 1), "Description for item " + (j + 1)));
                }
                
                rowsAdapter.add(new ListRow(header, listRowAdapter));
            }
            
            setAdapter(rowsAdapter);
        }

        private void setupEventListeners() {
            setOnItemViewClickedListener((itemViewHolder, item, rowViewHolder, row) -> {
                MovieItem movie = (MovieItem) item;
                
            });
            
            setOnItemViewSelectedListener((itemViewHolder, item, rowViewHolder, row) -> {
                
            });
        }

        private static class MovieItem {
            private final String title;
            private final String description;
            
            MovieItem(String title, String description) {
                this.title = title;
                this.description = description;
            }
            
            public String getTitle() { return title; }
            public String getDescription() { return description; }
        }

        private static class CardPresenter extends Presenter {
            @Override
            public ViewHolder onCreateViewHolder(ViewGroup parent) {
                android.view.View view = android.view.LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.tv_card_item, parent, false);
                return new ViewHolder(view);
            }

            @Override
            public void onBindViewHolder(ViewHolder viewHolder, Object item) {
                MovieItem movie = (MovieItem) item;
                android.widget.TextView titleView = viewHolder.view.findViewById(R.id.card_title);
                android.widget.TextView descView = viewHolder.view.findViewById(R.id.card_description);
                titleView.setText(movie.getTitle());
                descView.setText(movie.getDescription());
            }

            @Override
            public void onUnbindViewHolder(ViewHolder viewHolder) {
                
            }
        }
    }
}`;

  
  files['android/app/src/main/res/layout/tv_main_activity.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/background">

    <fragment
        android:id="@+id/tv_main_fragment"
        android:name="androidx.leanback.app.BrowseFragment"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</FrameLayout>`;

  files['android/app/src/main/res/layout/tv_card_item.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="250dp"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:focusable="true"
    android:focusableInTouchMode="true"
    android:background="@drawable/tv_card_background"
    android:padding="8dp">

    <ImageView
        android:id="@+id/card_image"
        android:layout_width="match_parent"
        android:layout_height="140dp"
        android:scaleType="centerCrop"
        android:src="@drawable/tv_placeholder" />

    <TextView
        android:id="@+id/card_title"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:textSize="16sp"
        android:textColor="@android:color/white"
        android:textStyle="bold"
        android:maxLines="2"
        android:ellipsize="end"
        android:layout_marginTop="8dp" />

    <TextView
        android:id="@+id/card_description"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:textSize="12sp"
        android:textColor="@android:color/darker_gray"
        android:maxLines="2"
        android:ellipsize="end" />

</LinearLayout>`;

  
  files['android/app/src/main/res/drawable/tv_card_background.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<selector xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:state_focused="true">
        <shape android:shape="rectangle">
            <solid android:color="@color/colorPrimary" />
            <corners android:radius="8dp" />
            <stroke android:width="2dp" android:color="@color/colorAccent" />
        </shape>
    </item>
    <item>
        <shape android:shape="rectangle">
            <solid android:color="#1E1E1E" />
            <corners android:radius="8dp" />
        </shape>
    </item>
</selector>`;

  files['android/app/src/main/res/drawable/tv_placeholder.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#333333" />
    <corners android:radius="8dp" />
</shape>`;

  
  files['android/app/src/main/res/values/tv_colors.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="theme_color">${cfg.themeColor || '#4f46e5'}</color>
    <color name="colorPrimary">${cfg.themeColor || '#4f46e5'}</color>
    <color name="colorPrimaryDark">${cfg.themeColor || '#4f46e5'}</color>
    <color name="colorAccent">${cfg.accentColor || '#4f46e5'}</color>
    <color name="background">#0B0F1A</color>
</resources>`;

  
  files['android/app/src/main/res/values/tv_themes.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.Leanback" parent="Theme.Leanback.Base">
        <item name="android:windowBackground">@color/background</item>
    </style>
    
    <style name="Theme.Leanback.Base" parent="Theme.AppCompat">
        <item name="android:windowNoTitle">true</item>
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowContentOverlay">@null</item>
    </style>
</resources>`;

  return files;
}

function wearFiles(cfg) {
  if (!cfg.wearEnabled) return {};

  const pkgPath = cfg.packageName.replace(/\./g, '/');
  const files = {};

  
  files['wear-build.gradle.patch'] = `
dependencies {
    implementation 'androidx.wear:wear:1.3.0'
    implementation 'androidx.wear:wear-complications-data:1.2.0'
    implementation 'androidx.wear:wear-watchface:1.2.0'
    implementation 'androidx.wear:wear-watchface-complications-rendering:1.2.0'
    implementation 'androidx.wear:wear-watchface-client:1.2.0'
    implementation 'androidx.wear:wear-watchface-data:1.2.0'
    implementation 'androidx.wear:wear-watchface-editor:1.2.0'
    implementation 'androidx.wear:wear-watchface-style:1.2.0'
    implementation 'androidx.wear:wear-tiles:1.2.0'
    implementation 'androidx.wear:wear-protolayout:1.1.0'
    implementation 'androidx.wear:wear-protolayout-expression:1.1.0'
    implementation 'androidx.wear:wear-protolayout-material:1.1.0'
    implementation 'androidx.wear:wear-protolayout-proto:1.1.0'
}`;

  
  if (cfg.watchFaceEnabled) {
    files[`android/app/src/main/java/${pkgPath}/WatchFaceService.java`] = `package ${cfg.packageName};

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.service.wallpaper.WallpaperService;
import android.view.SurfaceHolder;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.wear.watchface.CanvasComplicationFactory;
import androidx.wear.watchface.ComplicationData;
import androidx.wear.watchface.ComplicationSlot;
import androidx.wear.watchface.WatchFace;
import androidx.wear.watchface.control.WatchFaceControlClient;
import androidx.wear.watchface.style.WatchFaceStyle;
import androidx.wear.watchface.complications.rendering.CanvasComplication;
import androidx.wear.watchface.complications.rendering.ComplicationDrawable;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class WatchFaceService extends WallpaperService {
    private static final String TAG = "WatchFaceService";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public Engine onCreateEngine() {
        return new WatchFaceEngine();
    }

    private class WatchFaceEngine extends Engine {
        private final Paint backgroundPaint = new Paint();
        private final Paint textPaint = new Paint();
        private final Paint complicationPaint = new Paint();
        private final Handler handler = new Handler(Looper.getMainLooper());
        private final Runnable timeTickRunnable = this::invalidate;
        private ComplicationDrawable complicationDrawable;
        private boolean registeredComplicationCallback = false;

        public WatchFaceEngine() {
            backgroundPaint.setColor(Color.BLACK);
            textPaint.setColor(Color.WHITE);
            textPaint.setTextSize(48f);
            textPaint.setAntiAlias(true);
            textPaint.setTextAlign(Paint.Align.CENTER);
            
            complicationPaint.setColor(Color.WHITE);
            complicationPaint.setTextSize(24f);
            complicationPaint.setAntiAlias(true);
        }

        @Override
        public void onCreate(SurfaceHolder holder) {
            super.onCreate(holder);
            setWatchFaceStyle(new WatchFaceStyle.Builder(WatchFaceService.this)
                .setAcceptsTapEvents(true)
                .build());
        }

        @Override
        public void onVisibilityChanged(boolean visible) {
            super.onVisibilityChanged(visible);
            if (visible) {
                registerComplicationCallback();
                handler.post(timeTickRunnable);
            } else {
                unregisterComplicationCallback();
                handler.removeCallbacks(timeTickRunnable);
            }
        }

        @Override
        public void onSurfaceChanged(SurfaceHolder holder, int format, int width, int height) {
            super.onSurfaceChanged(holder, format, width, height);
        }

        @Override
        public void onDraw(@NonNull Canvas canvas, @NonNull Rect bounds) {
            super.onDraw(canvas, bounds);
            
            canvas.drawRect(bounds, backgroundPaint);
            
            
            String time = new java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
                .format(new java.util.Date());
            canvas.drawText(time, bounds.centerX(), bounds.centerY() - 50, textPaint);
            
            
            String date = new java.text.SimpleDateFormat("EEE, MMM d", java.util.Locale.getDefault())
                .format(new java.util.Date());
            canvas.drawText(date, bounds.centerX(), bounds.centerY() + 10, complicationPaint);
            
            
            if (complicationDrawable != null) {
                complicationDrawable.setBounds(
                    bounds.centerX() - 100,
                    bounds.centerY() + 60,
                    bounds.centerX() + 100,
                    bounds.centerY() + 140
                );
                complicationDrawable.draw(canvas);
            }
        }

        @Override
        public void onTapCommand(@NonNull int tapType, int x, int y, long eventTime) {
            super.onTapCommand(tapType, x, y, eventTime);
            
        }

        private void registerComplicationCallback() {
            if (registeredComplicationCallback) return;
            registeredComplicationCallback = true;
            
            WatchFaceControlClient client = WatchFaceControlClient.getOrCreate(WatchFaceService.this);
            client.getComplicationData(/* complicationId */)
                .addOnSuccessListener(complicationData -> {
                    if (complicationData != null) {
                        complicationDrawable = ComplicationDrawable.createFromComplicationData(
                            WatchFaceService.this, complicationData);
                    }
                });
        }

        private void unregisterComplicationCallback() {
            registeredComplicationCallback = false;
        }
    }
}`;

    
    if (cfg.complicationsEnabled) {
      files[`android/app/src/main/java/${pkgPath}/ComplicationProviderService.java`] = `package ${cfg.packageName};

import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import androidx.annotation.NonNull;
import androidx.wear.watchface.complications.data.ComplicationData;
import androidx.wear.watchface.complications.data.ComplicationProviderService;
import androidx.wear.watchface.complications.data.ComplicationType;

public class ComplicationProviderService extends ComplicationProviderService {
    private static final String TAG = "ComplicationProvider";
    
    private static final int UPDATE_PERIOD_SECONDS = 3600;

    @Override
    public void onComplicationUpdate(
            @NonNull int complicationId,
            @NonNull ComplicationType type,
            @NonNull ComplicationProviderService.ComplicationUpdateCallback callback) {
        
        ComplicationData data = null;
        
        switch (type) {
            case SHORT_TEXT:
                data = new ComplicationData.Builder(ComplicationType.SHORT_TEXT)
                    .setShortText("Short Text")
                    .build();
                break;
            case LONG_TEXT:
                data = new ComplicationData.Builder(ComplicationType.LONG_TEXT)
                    .setLongText("Long text complication data")
                    .build();
                break;
            case RANGED_VALUE:
                data = new ComplicationData.Builder(ComplicationType.RANGED_VALUE)
                    .setRangedValue(0.75f)
                    .setMin(0f)
                    .setMax(1f)
                    .setShortText("Progress")
                    .build();
                break;
            case GOAL_PROGRESS:
                data = new ComplicationData.Builder(ComplicationType.GOAL_PROGRESS)
                    .setRangedValue(0.6f)
                    .setMin(0f)
                    .setMax(1f)
                    .setShortText("Goal")
                    .build();
                break;
        }
        
        if (data != null) {
            callback.onComplicationData(data);
        } else {
            callback.onComplicationData(
                new ComplicationData.Builder(ComplicationType.SHORT_TEXT)
                    .setShortText("N/A")
                    .build()
            );
        }
    }

    @Override
    public void onComplicationActivated(int complicationId, int type, Bundle extras) {
        super.onComplicationActivated(complicationId, type, extras);
    }
}`;

      
      files['android/app/src/main/res/xml/watch_face.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<wallpaper xmlns:android="http://schemas.android.com/apk/res/android"
    android:thumbnail="@drawable/watch_face_preview"
    android:description="@string/watch_face_description" />`;

      
      files['android/app/src/main/res/drawable/watch_face_preview.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="320dp"
    android:height="320dp"
    android:viewportWidth="320"
    android:viewportHeight="320">
    <path
        android:fillColor="#4f46e5"
        android:pathData="M160,160m-150,0a150,150 0,1 1,300,0a150,150 0,1 1,-300,0" />
    <text
        android:fillColor="#FFFFFF"
        android:fontSize="48"
        android:x="160"
        android:y="180"
        android:text="${cfg.appName}"
        android:gravity="center" />
</vector>`;

      files['android/app/src/main/res/drawable/watch_face_preview_circular.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="320dp"
    android:height="320dp"
    android:viewportWidth="320"
    android:viewportHeight="320">
    <path
        android:fillColor="#4f46e5"
        android:pathData="M160,160m-150,0a150,150 0,1 1,300,0a150,150 0,1 1,-300,0" />
    <text
        android:fillColor="#FFFFFF"
        android:fontSize="48"
        android:x="160"
        android:y="180"
        android:text="${cfg.appName}"
        android:gravity="center" />
</vector>`;

      
      files['android/app/src/main/res/values/wear_strings.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="watch_face_description">${cfg.appName} Watch Face</string>
    <string name="complication_short_text">Short Text</string>
    <string name="complication_long_text">Long Text Complication</string>
    <string name="complication_ranged_value">Progress</string>
    <string name="complication_goal_progress">Goal Progress</string>
</resources>`;
    }
  }

  
  files[`android/app/src/main/java/${pkgPath}/WearMainActivity.java`] = `package ${cfg.packageName};

import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.wear.ambient.AmbientModeSupport;
import androidx.wear.widget.BoxInsetLayout;
import android.widget.TextView;

public class WearMainActivity extends AppCompatActivity implements AmbientModeSupport.AmbientCallbackProvider {
    private TextView textView;
    private boolean isAmbient = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.wear_main_activity);
        
        textView = findViewById(R.id.wear_text);
        textView.setText("${cfg.appName}");
        
        AmbientModeSupport.attach(this);
    }

    @Override
    public AmbientModeSupport.AmbientCallback getAmbientCallback() {
        return new AmbientModeSupport.AmbientCallback() {
            @Override
            public void onEnterAmbient(Bundle ambientDetails) {
                super.onEnterAmbient(ambientDetails);
                isAmbient = true;
                textView.setTextColor(0xFFFFFFFF);
                textView.setText("Ambient Mode");
                invalidateOptionsMenu();
            }

            @Override
            public void onExitAmbient() {
                super.onExitAmbient();
                isAmbient = false;
                textView.setTextColor(0xFFFFFFFF);
                textView.setText("${cfg.appName}");
                invalidateOptionsMenu();
            }

            @Override
            public void onUpdateAmbient() {
                super.onUpdateAmbient();
                
            }
        };
    }
}`;

  files['android/app/src/main/res/layout/wear_main_activity.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<androidx.wear.widget.BoxInsetLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/background"
    android:padding="@dimen/box_inset_layout_padding">

    <FrameLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        app:layout_box="all">

        <TextView
            android:id="@+id/wear_text"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_gravity="center"
            android:textSize="24sp"
            android:textColor="@android:color/white"
            android:text="${cfg.appName}" />

    </FrameLayout>

</androidx.wear.widget.BoxInsetLayout>`;

  files['android/app/src/main/res/values/wear_dimens.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <dimen name="box_inset_layout_padding">8dp</dimen>
</resources>`;

  return files;
}

function chromeosFiles(cfg) {
  if (!cfg.chromeosEnabled) return {};

  const pkgPath = cfg.packageName.replace(/\./g, '/');
  const files = {};

  
  files['chromeos-build.gradle.patch'] = `
android {
    defaultConfig {
        
        multiDexEnabled true
    }
    
    
    buildFeatures {
        viewBinding true
    }
}`;

  
  files[`android/app/src/main/java/${pkgPath}/ChromeOSFiles.java`] = `package ${cfg.packageName};

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.ProviderInfo;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.provider.DocumentsProvider;
import android.text.TextUtils;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@RequiresApi(api = Build.VERSION_CODES.KITKAT)
public class ChromeOSFiles extends DocumentsProvider {
    private static final String TAG = "ChromeOSFiles";
    private static final String AUTHORITY = "${cfg.packageName}.files";
    
    private static final String ROOT_ID = "root";
    private static final String ROOT_NAME = "App Files";
    
    private static final String[] DEFAULT_ROOT_PROJECTION = new String[]{
        DocumentsContract.Root.COLUMN_ROOT_ID,
        DocumentsContract.Root.COLUMN_SUMMARY,
        DocumentsContract.Root.COLUMN_FLAGS,
        DocumentsContract.Root.COLUMN_TITLE,
        DocumentsContract.Root.COLUMN_DOCUMENT_ID,
        DocumentsContract.Root.COLUMN_MIME_TYPES,
        DocumentsContract.Root.COLUMN_AVAILABLE_BYTES,
        DocumentsContract.Root.COLUMN_CAPACITY_BYTES,
        DocumentsContract.Root.COLUMN_ICON
    };
    
    private static final String[] DEFAULT_DOCUMENT_PROJECTION = new String[]{
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_LAST_MODIFIED,
        DocumentsContract.Document.COLUMN_FLAGS,
        DocumentsContract.Document.COLUMN_SIZE,
        DocumentsContract.Document.COLUMN_ICON
    };

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor queryRoots(@NonNull String[] projection) {
        MatrixCursor result = new MatrixCursor(resolveRootProjection(projection));
        
        MatrixCursor.RowBuilder row = result.newRow();
        row.add(DocumentsContract.Root.COLUMN_ROOT_ID, ROOT_ID);
        row.add(DocumentsContract.Root.COLUMN_SUMMARY, ROOT_NAME);
        row.add(DocumentsContract.Root.COLUMN_FLAGS, 
            DocumentsContract.Root.FLAG_SUPPORTS_CREATE |
            DocumentsContract.Root.FLAG_SUPPORTS_RECENTS |
            DocumentsContract.Root.FLAG_SUPPORTS_SEARCH |
            DocumentsContract.Root.FLAG_SUPPORTS_IS_CHILD);
        row.add(DocumentsContract.Root.COLUMN_TITLE, ROOT_NAME);
        row.add(DocumentsContract.Root.COLUMN_DOCUMENT_ID, ROOT_ID);
        row.add(DocumentsContract.Root.COLUMN_MIME_TYPES, new String[]{"*/*"});
        row.add(DocumentsContract.Root.COLUMN_AVAILABLE_BYTES, getAvailableBytes());
        row.add(DocumentsContract.Root.COLUMN_CAPACITY_BYTES, getTotalBytes());
        row.add(DocumentsContract.Root.COLUMN_ICON, getIcon());
        
        return result;
    }

    @Override
    public Cursor queryDocument(@NonNull String documentId, @NonNull String[] projection) {
        MatrixCursor result = new MatrixCursor(resolveDocumentProjection(projection));
        includeDocument(documentId, result);
        return result;
    }

    @Override
    public Cursor queryChildDocuments(
            @NonNull String parentDocumentId,
            @NonNull String[] projection,
            @Nullable String sortOrder) {
        
        MatrixCursor result = new MatrixCursor(resolveDocumentProjection(projection));
        
        File parentDir = getFileForDocId(parentDocumentId);
        if (parentDir != null && parentDir.isDirectory()) {
            File[] files = parentDir.listFiles();
            if (files != null) {
                for (File file : files) {
                    includeDocument(getDocIdForFile(file), result);
                }
            }
        }
        
        return result;
    }

    @Override
    public String getDocumentType(@NonNull String documentId) {
        File file = getFileForDocId(documentId);
        if (file == null) return null;
        
        if (file.isDirectory()) {
            return DocumentsContract.Document.MIME_TYPE_DIR;
        } else {
            String mimeType = getMimeType(file.getName());
            return mimeType != null ? mimeType : "application/octet-stream";
        }
    }

    @Override
    public ParcelFileDescriptor openDocument(
            @NonNull String documentId,
            @NonNull String mode,
            @Nullable CancellationSignal signal) throws FileNotFoundException {
        
        File file = getFileForDocId(documentId);
        if (file == null) {
            throw new FileNotFoundException("Document not found: " + documentId);
        }
        
        int accessMode = ParcelFileDescriptor.MODE_READ_ONLY;
        if (mode.contains("w") || mode.contains("rw")) {
            accessMode = ParcelFileDescriptor.MODE_READ_WRITE;
        }
        
        return ParcelFileDescriptor.open(file, accessMode);
    }

    @Override
    public AssetFileDescriptor openDocumentThumbnail(
            @NonNull String documentId,
            @Nullable android.graphics.Point sizeHint,
            @Nullable CancellationSignal signal) {
        return super.openDocumentThumbnail(documentId, sizeHint, signal);
    }

    @Override
    public String createDocument(
            @NonNull String parentDocumentId,
            @NonNull String mimeType,
            @NonNull String displayName) {
        
        File parentDir = getFileForDocId(parentDocumentId);
        if (parentDir == null || !parentDir.isDirectory()) {
            return null;
        }
        
        File newFile = new File(parentDir, displayName);
        try {
            if (mimeType.equals(DocumentsContract.Document.MIME_TYPE_DIR)) {
                newFile.mkdirs();
            } else {
                newFile.createNewFile();
            }
            return getDocIdForFile(newFile);
        } catch (IOException e) {
            Log.e(TAG, "Failed to create document", e);
            return null;
        }
    }

    @Override
    public void deleteDocument(@NonNull String documentId) {
        File file = getFileForDocId(documentId);
        if (file != null) {
            deleteRecursive(file);
        }
    }

    @Override
    public String renameDocument(@NonNull String documentId, @NonNull String displayName) {
        File file = getFileForDocId(documentId);
        if (file == null) return null;
        
        File newFile = new File(file.getParent(), displayName);
        if (file.renameTo(newFile)) {
            return getDocIdForFile(newFile);
        }
        return null;
    }

    @Override
    public Bundle queryDocumentMetadata(@NonNull String documentId, @NonNull String[] projection) {
        return super.queryDocumentMetadata(documentId, projection);
    }

    private void includeDocument(String documentId, MatrixCursor result) {
        File file = getFileForDocId(documentId);
        if (file == null) return;
        
        MatrixCursor.RowBuilder row = result.newRow();
        row.add(DocumentsContract.Document.COLUMN_DOCUMENT_ID, documentId);
        row.add(DocumentsContract.Document.COLUMN_MIME_TYPE, getDocumentType(documentId));
        row.add(DocumentsContract.Document.COLUMN_DISPLAY_NAME, file.getName());
        row.add(DocumentsContract.Document.COLUMN_LAST_MODIFIED, file.lastModified());
        
        int flags = 0;
        if (file.canRead()) flags |= DocumentsContract.Document.FLAG_SUPPORTS_READ;
        if (file.canWrite()) flags |= DocumentsContract.Document.FLAG_SUPPORTS_WRITE;
        if (file.isDirectory()) {
            flags |= DocumentsContract.Document.FLAG_DIR_PREFERS_GRID;
            flags |= DocumentsContract.Document.FLAG_DIR_PREFERS_LAST_SORTED_DESCENDING;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            if (file.canRead()) flags |= DocumentsContract.Document.FLAG_SUPPORTS_THUMBNAIL;
        }
        row.add(DocumentsContract.Document.COLUMN_FLAGS, flags);
        row.add(DocumentsContract.Document.COLUMN_SIZE, file.length());
        row.add(DocumentsContract.Document.COLUMN_ICON, getIconForFile(file));
    }

    private File getFileForDocId(String documentId) {
        if (ROOT_ID.equals(documentId)) {
            return getContext().getFilesDir();
        }
        
        
        String relativePath = documentId.substring(ROOT_ID.length() + 1);
        return new File(getContext().getFilesDir(), relativePath);
    }

    private String getDocIdForFile(File file) {
        try {
            String absolutePath = file.getCanonicalPath();
            String basePath = getContext().getFilesDir().getCanonicalPath();
            if (absolutePath.equals(basePath)) {
                return ROOT_ID;
            }
            if (absolutePath.startsWith(basePath + File.separator)) {
                return ROOT_ID + "/" + absolutePath.substring(basePath.length() + 1);
            }
        } catch (IOException e) {
            Log.e(TAG, "Failed to get canonical path", e);
        }
        return null;
    }

    private String[] resolveRootProjection(String[] projection) {
        if (projection == null || projection.length == 0) {
            return DEFAULT_ROOT_PROJECTION;
        }
        return projection;
    }

    private String[] resolveDocumentProjection(String[] projection) {
        if (projection == null || projection.length == 0) {
            return DEFAULT_DOCUMENT_PROJECTION;
        }
        return projection;
    }

    private long getAvailableBytes() {
        try {
            return getContext().getFilesDir().getUsableSpace();
        } catch (Exception e) {
            return 0;
        }
    }

    private long getTotalBytes() {
        try {
            return getContext().getFilesDir().getTotalSpace();
        } catch (Exception e) {
            return 0;
        }
    }

    private int getIcon() {
        return android.R.drawable.ic_menu_save;
    }

    private int getIconForFile(File file) {
        if (file.isDirectory()) {
            return android.R.drawable.ic_menu_archive;
        }
        String name = file.getName().toLowerCase();
        if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
            return android.R.drawable.ic_menu_gallery;
        } else if (name.endsWith(".pdf")) {
            return android.R.drawable.ic_menu_view;
        } else if (name.endsWith(".txt")) {
            return android.R.drawable.ic_menu_edit;
        }
        return android.R.drawable.ic_menu_save;
    }

    private String getMimeType(String fileName) {
        String extension = "";
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex > 0) {
            extension = fileName.substring(dotIndex + 1).toLowerCase();
        }
        
        switch (extension) {
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "gif": return "image/gif";
            case "pdf": return "application/pdf";
            case "txt": return "text/plain";
            case "html": case "htm": return "text/html";
            case "css": return "text/css";
            case "js": return "application/javascript";
            case "json": return "application/json";
            case "xml": return "application/xml";
            case "zip": return "application/zip";
            case "mp4": return "video/mp4";
            case "mp3": return "audio/mpeg";
            default: return null;
        }
    }

    private void deleteRecursive(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        file.delete();
    }
}`;

  
  files[`android/app/src/main/java/${pkgPath}/ChromeOSMainActivity.java`] = `package ${cfg.packageName};

import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebSettings;

public class ChromeOSMainActivity extends AppCompatActivity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.chromeos_main_activity);
        
        webView = findViewById(R.id.chromeos_webview);
        setupWebView();
        
        
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus();
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        
        
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        
        
        settings.setSupportZoom(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        
        
        String url = getIntent().getDataString();
        if (url == null || url.isEmpty()) {
            url = "file:/
        }
        webView.loadUrl(url);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        
        switch (keyCode) {
            case KeyEvent.KEYCODE_ESCAPE:
                if (webView.canGoBack()) {
                    webView.goBack();
                    return true;
                }
                break;
            case KeyEvent.KEYCODE_F5:
                webView.reload();
                return true;
            case KeyEvent.KEYCODE_F11:
                
                return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onGenericMotionEvent(MotionEvent event) {
        
        if ((event.getSource() & android.view.InputDevice.SOURCE_MOUSE) != 0) {
            switch (event.getAction()) {
                case MotionEvent.ACTION_HOVER_ENTER:
                case MotionEvent.ACTION_HOVER_MOVE:
                case MotionEvent.ACTION_HOVER_EXIT:
                    
                    return true;
                case MotionEvent.ACTION_SCROLL:
                    
                    return true;
            }
        }
        return super.onGenericMotionEvent(event);
    }

    @Override
    public void onMultiWindowModeChanged(boolean isInMultiWindowMode) {
        super.onMultiWindowModeChanged(isInMultiWindowMode);
        
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode);
        
    }
}`;

  files['android/app/src/main/res/layout/chromeos_main_activity.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:fitsSystemWindows="true">

    <WebView
        android:id="@+id/chromeos_webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</FrameLayout>`;

  
  files['android/app/src/main/res/values/chromeos_themes.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.ChromeOS" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="android:windowSoftInputMode">adjustResize</item>
        <item name="android:resizeableActivity">true</item>
        <item name="android:supportsPictureInPicture">true</item>
        <item name="android:windowIsTranslucent">false</item>
    </style>
</resources>`;

  
  files['android/app/src/main/res/values/chromeos_strings.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${cfg.appName}</string>
    <string name="chromeos_file_provider_name">${cfg.packageName}.files</string>
</resources>`;

  return files;
}

module.exports = { tvFiles, wearFiles, chromeosFiles };